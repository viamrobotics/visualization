import type { Entity, World } from 'koota'

import type { RefreshRateId } from '#lib/hooks/useSettings.svelte.js'

import { relations, traits } from '#lib/ecs/index.js'

export interface TreeFolderRow {
	/** See `traits.Folder`. What a log line names when it is about this folder. */
	id: string
	/** Display name. Folder entities carry no `Name`, which keeps them out of every row query. */
	name: string
	/** Starts closed. See `traits.Folder`. */
	collapsed: boolean
	/** Poll that fills the folder. See `traits.Folder`. */
	refreshRate?: RefreshRateId
	/** Entities in the folder at any depth, not just the rows directly under it. */
	itemCount: number
	/** Shown in place of rows while the folder is empty. */
	placeholder?: string
}

/** The worst issue among a row's descendants, for a collapsed row to hint at. */
export interface IssueRollup {
	severity: traits.IssueSeverity
	/** Descendant entities carrying any issue. */
	count: number
}

export interface TreeNode {
	entity: Entity
	children?: TreeNode[]
	/** Set only on a folder row. Its truthiness is what marks the row as a folder. */
	folder?: TreeFolderRow
	/** Row with no scene object behind it. See `traits.Folder`. */
	sceneless?: boolean
	/** The `ChildOf` parent, set when it sits in another folder. */
	detachedParent?: Entity
	/** The parent name an `Orphan` is waiting for, which has no entity to link. */
	missingParent?: string
	/** Set when a descendant carries `Issues`. The row's own issues are not counted. */
	rollup?: IssueRollup
}

export interface Tree {
	nodes: TreeNode[]
	/** Child value to parent value, following drawn edges rather than `ChildOf`. */
	parents: Map<string, string>
}

/** The folders the tree itself owns, which claim by rule rather than by source. */
export interface FallbackFolders {
	/** Every `Orphan`, whatever produced it, so it never passes for a root. */
	missingParent: Entity
	/** Whatever no folder claims. */
	other: Entity
}

const collator = new Intl.Collator()

const compareByName = (a: Entity, b: Entity): number =>
	collator.compare(a.get(traits.Name) ?? '', b.get(traits.Name) ?? '')

const severityRank = (severity: traits.IssueSeverity): number =>
	traits.ISSUE_SEVERITIES.indexOf(severity)

const worstSeverity = (entity: Entity): traits.IssueSeverity | undefined => {
	let worst: traits.IssueSeverity | undefined
	for (const lines of entity.get(traits.Issues)?.values() ?? []) {
		for (const { severity } of lines) {
			if (worst === undefined || severityRank(severity) > severityRank(worst)) worst = severity
		}
	}
	return worst
}

const mergeRollup = (
	into: IssueRollup | undefined,
	severity: traits.IssueSeverity | undefined,
	count: number
): IssueRollup | undefined => {
	if (severity === undefined) return into
	if (!into) return { severity, count }

	return {
		severity: severityRank(severity) > severityRank(into.severity) ? severity : into.severity,
		count: into.count + count,
	}
}

/** Folds a child row into its parent's rollup: the child's own issues, then everything under it. */
const rollupWithChild = (into: IssueRollup | undefined, child: TreeNode): IssueRollup | undefined =>
	mergeRollup(
		mergeRollup(into, worstSeverity(child.entity), 1),
		child.rollup?.severity,
		child.rollup?.count ?? 0
	)

/** The rollup a row with these children carries. Each child's own `rollup` must already be set. */
export const rollupOfChildren = (children: readonly TreeNode[]): IssueRollup | undefined => {
	let rollup: IssueRollup | undefined
	for (const child of children) rollup = rollupWithChild(rollup, child)
	return rollup
}

const sourceFoldersOf = (world: World, fallback: FallbackFolders): Entity[] =>
	world
		.query(traits.Folder)
		.filter((entity) => entity !== fallback.missingParent && entity !== fallback.other)
		.toSorted((a, b) => (a.get(traits.Folder)?.order ?? 0) - (b.get(traits.Folder)?.order ?? 0))

/**
 * Named entities grouped into the world's `Folder` entities, in `order`. A folder that
 * claims nothing is left out unless it is pinned or has a placeholder. Orphans sit in
 * `fallback.missingParent` until the resolver places them, and anything unclaimed
 * lands in `fallback.other`.
 */
export const buildTree = (world: World, fallback: FallbackFolders): Tree => {
	const parents = new Map<string, string>()
	const entities = world.query(traits.Name)
	const rows = new Set<Entity>(entities)

	const sourceFolders = sourceFoldersOf(world, fallback)
	const folders = [...sourceFolders, fallback.missingParent, fallback.other]

	const ownFolder = (entity: Entity): Entity | undefined => {
		// Checked ahead of the sources, since a frame or a point cloud with no parent
		// in the scene would otherwise sit among its siblings looking like a root.
		if (entity.has(traits.Orphan)) return fallback.missingParent

		for (const folder of sourceFolders) {
			for (const source of folder.get(traits.Folder)?.sources ?? []) {
				if (entity.has(source)) return folder
			}
		}

		return undefined
	}

	const folderOf = new Map<Entity, Entity>()

	/**
	 * An entity with no source trait takes its parent's folder, so untagged
	 * sub-entities (model assets, geometry children) stay with what they belong to.
	 */
	const folderFor = (entity: Entity): Entity => {
		const chain: Entity[] = []
		let cursor: Entity | undefined = entity
		let resolved: Entity | undefined

		while (cursor) {
			resolved = folderOf.get(cursor) ?? ownFolder(cursor)
			if (resolved !== undefined) break

			chain.push(cursor)
			const parent: Entity | undefined = cursor.targetFor(relations.ChildOf)
			// A `ChildOf` cycle is pathological (`recomputeWorldMatrix` warns on one)
			// but would spin this walk forever.
			cursor = parent?.isAlive() && !chain.includes(parent) ? parent : undefined
		}

		resolved ??= fallback.other
		if (cursor) folderOf.set(cursor, resolved)
		for (const link of chain) folderOf.set(link, resolved)

		return resolved
	}

	const childrenOf = new Map<Entity, Entity[]>()
	const folderRoots = new Map<Entity, Entity[]>(folders.map((folder) => [folder, []]))
	const folderCounts = new Map<Entity, number>()

	for (const entity of entities) {
		const folder = folderFor(entity)
		const parent = entity.targetFor(relations.ChildOf)

		folderCounts.set(folder, (folderCounts.get(folder) ?? 0) + 1)

		// Edges that leave a folder aren't drawn. The relation itself is untouched,
		// so world matrices and the visibility cascade still compose through it.
		if (parent && rows.has(parent) && folderFor(parent) === folder) {
			const siblings = childrenOf.get(parent)
			if (siblings) siblings.push(entity)
			else childrenOf.set(parent, [entity])
		} else {
			folderRoots.get(folder)?.push(entity)
		}
	}

	const walk = (entity: Entity): TreeNode => {
		const node: TreeNode = { entity }
		const children = childrenOf.get(entity)

		if (children) {
			children.sort(compareByName)
			node.children = children.map((child) => {
				parents.set(`${child}`, `${entity}`)
				return walk(child)
			})
			node.rollup = rollupOfChildren(node.children)
		}

		return node
	}

	const nodes: TreeNode[] = []

	for (const folder of folders) {
		const roots = folderRoots.get(folder) ?? []
		const spec = folder.get(traits.Folder)
		const isEmpty = roots.length === 0

		if (isEmpty && !spec?.pinned && spec?.placeholder === undefined) continue

		roots.sort(compareByName)

		const children = roots.map((entity) => {
			parents.set(`${entity}`, `${folder}`)

			const child = walk(entity)
			child.sceneless = spec?.sceneless
			const parent = entity.targetFor(relations.ChildOf)
			if (parent?.isAlive() && parent.get(traits.Name)) child.detachedParent = parent
			const missingParent = entity.get(traits.Orphan)
			if (missingParent) child.missingParent = missingParent

			return child
		})

		nodes.push({
			entity: folder,
			folder: {
				id: spec?.id ?? '',
				name: spec?.name ?? '',
				collapsed: spec?.collapsed ?? false,
				refreshRate: spec?.refreshRate,
				itemCount: folderCounts.get(folder) ?? 0,
				placeholder: isEmpty ? spec?.placeholder : undefined,
			},
			children,
			rollup: rollupOfChildren(children),
		})
	}

	return { nodes, parents }
}
