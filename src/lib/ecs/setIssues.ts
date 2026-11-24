import type { Entity } from 'koota'

import { type IssueLine, Issues } from './traits'

// A counted line is only the same line by identity: its count is the writer's live state.
const isSameLine = (a: IssueLine, b: IssueLine): boolean =>
	a === b ||
	(a.severity === b.severity &&
		a.message === b.message &&
		a.count === undefined &&
		b.count === undefined)

const isSameLines = (a: IssueLine[] | undefined, b: IssueLine[]): boolean =>
	(a?.length ?? 0) === b.length && b.every((line, index) => a && isSameLine(a[index], line))

/**
 * Replaces the lines `key` owns on `entity`, leaving other writers' lines alone.
 * An empty `lines` drops the key, and the last key takes the trait with it. Lines
 * equal to what is there already write nothing, since every change rebuilds the
 * world tree. A dead entity is skipped, so a writer can clear unconditionally on teardown.
 */
export const setIssues = (entity: Entity, key: string, lines: IssueLine[]): void => {
	if (!entity.isAlive()) return

	const current = entity.get(Issues)
	if (isSameLines(current?.get(key), lines)) return

	// A new map, since koota only reports a change when the value is replaced.
	const next = new Map(current)
	if (lines.length > 0) next.set(key, lines)
	else next.delete(key)

	if (next.size === 0) entity.remove(Issues)
	else if (current) entity.set(Issues, next)
	else entity.add(Issues(next))
}
