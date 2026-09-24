import type { Entity } from 'koota'

import { traits } from '$lib/ecs'

import type { CollisionReport } from './collisionStore.svelte'
import type { CollisionPair } from './collisionWorld'

import { liveFrameName } from '../previewNames'
import { GhostOf } from '../relations'
import { isGhost } from './collisionMembers'

/**
 * What to call an entity in the panel. A staged-move ghost has no `Name` of its own, so it borrows
 * its source's: the pair reads "gripper ↔ table" whether it describes where the gripper is or where
 * it would end up, and `staged` carries the difference.
 *
 * A preview twin has a real name, carrying the prefix that keeps it from colliding with the live
 * frame it mirrors. The panel is about the machine, not about how the preview is wired, so it reads
 * the live name.
 */
const displayName = (entity: Entity): string => {
	const own = entity.get(traits.Name)
	if (own) return liveFrameName(own)

	const source = entity.targetFor(GhostOf)
	const sourceName = source?.isAlive() ? source.get(traits.Name) : undefined
	return sourceName ?? 'unnamed'
}

/**
 * Turn detected pairs into what the panel renders, collapsing duplicates.
 *
 * Two colliders can share a display name, since an arm's links all label as the component
 * when unnamed, so the same pair of names can arrive more than once in a single pass. Sides
 * are ordered by name so a pair keys the same regardless of which collider Rapier reported
 * it from.
 */
export const toReports = (pairs: readonly CollisionPair[]): CollisionReport[] => {
	const byKey = new Map<string, CollisionReport>()

	for (const { a, b } of pairs) {
		const staged = isGhost(a) || isGhost(b)
		const [first, second] = [displayName(a), displayName(b)].toSorted()
		if (first === undefined || second === undefined) continue

		const key = `${staged ? 'staged' : 'live'}:${first}-${second}`
		if (byKey.has(key)) continue
		byKey.set(key, { a: first, b: second, staged })
	}

	// Staged pairs first: a move that would collide is the more urgent warning.
	return [...byKey.values()].toSorted((x, y) => Number(y.staged) - Number(x.staged))
}
