import type { Entity, World } from 'koota'

import { setIssues, traits } from '#lib/ecs/index.js'

import type { Log } from './useLogs.svelte'

const ISSUES_KEY = 'logs'

export interface LogIssueMirror {
	/**
	 * Writes every warn and error line in `logs` onto the rows it names, and clears
	 * rows that no longer have one. Lines keep their identity across calls, so a
	 * repeat that only bumps a count rewrites nothing.
	 */
	apply(logs: readonly Log[]): void
	/** Takes every line this mirror wrote back off its rows. */
	clear(): void
}

/**
 * Rows a resource name stands for. A name is not unique across the world: a drawn
 * transform takes its reference frame's name (`#lib/draw.ts`), so only frames and
 * frameless components count.
 */
const resourceRowsByName = (world: World): Map<string, Entity[]> => {
	const rows = new Map<string, Entity[]>()

	for (const entity of world.query(traits.Name)) {
		if (!entity.has(traits.FramesAPI) && !entity.has(traits.FramelessComponent)) continue

		const name = entity.get(traits.Name) ?? ''
		const named = rows.get(name)
		if (named) named.push(entity)
		else rows.set(name, [entity])
	}

	return rows
}

const folderRowsById = (world: World): Map<string, Entity> =>
	new Map(world.query(traits.Folder).map((entity) => [entity.get(traits.Folder)?.id ?? '', entity]))

/**
 * Mirrors log lines into `Issues` under the `logs` key.
 *
 * @param countOf Reads a line's live repeat count by `uuid`. It backs each line's
 * `count` getter, so a reactive source here re-renders a count without a trait write.
 */
export const createLogIssueMirror = (
	world: World,
	countOf: (uuid: string) => number | undefined
): LogIssueMirror => {
	const lineByUuid = new Map<string, traits.IssueLine>()
	let marked = new Set<Entity>()

	const lineFor = (log: Log & { level: traits.IssueSeverity }): traits.IssueLine => {
		const existing = lineByUuid.get(log.uuid)
		if (existing) return existing

		const line: traits.IssueLine = {
			severity: log.level,
			message: log.message,
			get count() {
				return countOf(log.uuid)
			},
		}
		lineByUuid.set(log.uuid, line)
		return line
	}

	const clear = () => {
		for (const entity of marked) setIssues(entity, ISSUES_KEY, [])
		marked = new Set()
		lineByUuid.clear()
	}

	const apply = (logs: readonly Log[]) => {
		const resources = resourceRowsByName(world)
		const folders = folderRowsById(world)
		const linesByEntity = new Map<Entity, traits.IssueLine[]>()

		const file = (entity: Entity, line: traits.IssueLine) => {
			const lines = linesByEntity.get(entity)
			if (lines) lines.push(line)
			else linesByEntity.set(entity, [line])
		}

		const live = new Set<string>()

		for (const log of logs) {
			if (log.level === 'info') continue

			live.add(log.uuid)
			const line = lineFor({ ...log, level: log.level })

			const named = log.resource === undefined ? undefined : resources.get(log.resource)
			for (const entity of named ?? []) file(entity, line)
			const folder = log.folder === undefined ? undefined : folders.get(log.folder)
			if (folder) file(folder, line)
		}

		for (const uuid of lineByUuid.keys()) {
			if (!live.has(uuid)) lineByUuid.delete(uuid)
		}

		for (const entity of marked) {
			if (!linesByEntity.has(entity)) setIssues(entity, ISSUES_KEY, [])
		}

		for (const [entity, lines] of linesByEntity) setIssues(entity, ISSUES_KEY, lines)
		marked = new Set(linesByEntity.keys())
	}

	return { apply, clear }
}
