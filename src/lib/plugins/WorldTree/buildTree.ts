import type { Entity, World } from 'koota'

import { Not } from 'koota'

import type { RefreshRateId } from '$lib/hooks/useSettings.svelte'

import { relations, traits } from '$lib/ecs'

import type { TreeFolderId } from './treeFolders'

import { treeFolders } from './treeFolders'

export interface TreeFolderRow {
	/** See `TreeFolder.id`. What a log line names when it is about this folder. */
	id: TreeFolderId
	/** Starts closed. See `TreeFolder.collapsed`. */
	collapsed?: boolean
	/** Poll that fills the folder. See `TreeFolder.refreshRate`. */
	refreshRate?: RefreshRateId
	/** Entities in the folder at any depth, not just the rows directly under it. */
	itemCount: number
}

export interface TreeNode {
	entity: Entity
	children?: TreeNode[]
	/**
	 * Set only on a folder row, which is backed by a synthetic entity with no scene
	 * presence. Its truthiness is what marks the row as a folder.
	 */
	folder?: TreeFolderRow
	/** Row with no scene object behind it. See `TreeFolder.sceneless`. */
	sceneless?: boolean
	/** The `ChildOf` parent, set when it sits in another folder. */
	detachedParent?: Entity
}

export interface Tree {
	nodes: TreeNode[]
	/** Child value to parent value, following drawn edges rather than `ChildOf`. */
	parents: Map<string, string>
}

const collator = new Intl.Collator()

const compareByName = (a: Entity, b: Entity): number =>
	collator.compare(a.get(traits.Name) ?? '', b.get(traits.Name) ?? '')

const otherFolder = treeFolders.length - 1

const ownFolder = (entity: Entity): number | undefined => {
	for (const [index, folder] of treeFolders.entries()) {
		for (const source of folder.sources) {
			if (entity.has(source)) return index
		}
	}

	return undefined
}

/**
 * Named entities grouped by source. `folderEntities` supplies one entity per entry
 * in `treeFolders`, in order. Folders that claim nothing are left out. Orphans are
 * hidden until the resolver places them.
 */
export const buildTree = (world: World, folderEntities: Entity[]): Tree => {
	const parents = new Map<string, string>()
	const entities = world.query(traits.Name, Not(traits.Orphan))
	const rows = new Set<Entity>(entities)

	const folderOf = new Map<Entity, number>()

	/**
	 * An entity with no source trait takes its parent's folder, so untagged
	 * sub-entities (model assets, geometry children) stay with what they belong to.
	 */
	const folderFor = (entity: Entity): number => {
		const chain: Entity[] = []
		let cursor: Entity | undefined = entity
		let resolved: number | undefined

		while (cursor) {
			resolved = folderOf.get(cursor) ?? ownFolder(cursor)
			if (resolved !== undefined) break

			chain.push(cursor)
			const parent: Entity | undefined = cursor.targetFor(relations.ChildOf)
			// A `ChildOf` cycle is pathological (`recomputeWorldMatrix` warns on one)
			// but would spin this walk forever.
			cursor = parent?.isAlive() && !chain.includes(parent) ? parent : undefined
		}

		resolved ??= otherFolder
		if (cursor) folderOf.set(cursor, resolved)
		for (const link of chain) folderOf.set(link, resolved)

		return resolved
	}

	const childrenOf = new Map<Entity, Entity[]>()
	const folderRoots: Entity[][] = treeFolders.map(() => [])
	const folderCounts: number[] = treeFolders.map(() => 0)

	for (const entity of entities) {
		const folder = folderFor(entity)
		const parent = entity.targetFor(relations.ChildOf)

		folderCounts[folder] += 1

		// Edges that leave a folder aren't drawn. The relation itself is untouched,
		// so world matrices and the visibility cascade still compose through it.
		if (parent && rows.has(parent) && folderFor(parent) === folder) {
			const siblings = childrenOf.get(parent)
			if (siblings) siblings.push(entity)
			else childrenOf.set(parent, [entity])
		} else {
			folderRoots[folder].push(entity)
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
		}

		return node
	}

	const nodes: TreeNode[] = []

	for (const [index, folder] of folderEntities.entries()) {
		const roots = folderRoots[index]
		if (roots.length === 0) continue

		roots.sort(compareByName)

		const { id, collapsed, refreshRate, sceneless } = treeFolders[index]

		nodes.push({
			entity: folder,
			folder: { id, collapsed, refreshRate, itemCount: folderCounts[index] },
			children: roots.map((entity) => {
				parents.set(`${entity}`, `${folder}`)

				const node = walk(entity)
				node.sceneless = sceneless
				const parent = entity.targetFor(relations.ChildOf)
				if (parent?.isAlive() && parent.get(traits.Name)) node.detachedParent = parent

				return node
			}),
		})
	}

	return { nodes, parents }
}
