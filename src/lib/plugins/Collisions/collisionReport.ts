import type { Entity } from 'koota'

import { traits } from '$lib/ecs'
import { liveFrameName } from '$lib/plugins/MoveFrame/previewNames'
import { GhostOf } from '$lib/plugins/MoveFrame/relations'

import type { CollisionPair, WorldPoint } from './collisionWorld'

import { isGhost } from './collisionMembers'

/** One side of a reported pair. */
export interface CollisionSide {
	name: string
	/** What a link to this side selects. A staged-move ghost has no row of its own, so it is its source. */
	entity: Entity
}

/** One intersecting pair, resolved to display names when it was detected. */
export interface CollisionReport {
	/** Stable across passes while the same two names overlap, so the pair keeps its tree row as it moves. */
	key: string
	a: CollisionSide
	b: CollisionSide
	/**
	 * True when either side is a ghost of a staged move. The pair describes
	 * where the move would end up rather than where the scene is now.
	 */
	staged: boolean
	/** The deepest overlap among the colliders sharing these names, in metres. */
	depth: number
	/** Where that deepest overlap sits, in world metres. */
	point: WorldPoint
}

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

const sideOf = (entity: Entity): CollisionSide => {
	const source = entity.targetFor(GhostOf)
	return { name: displayName(entity), entity: source?.isAlive() ? source : entity }
}

const compareSides = (x: CollisionSide, y: CollisionSide): number =>
	x.name < y.name ? -1 : x.name > y.name ? 1 : 0

/**
 * Turn detected pairs into what the panel renders, collapsing duplicates.
 *
 * Two colliders can share a display name, since an arm's links all label as the component
 * when unnamed, so the same pair of names can arrive more than once in a single pass. The
 * deepest of them is the one reported. Sides are ordered by name so a pair keys the same
 * regardless of which collider Rapier reported it from.
 */
export const toReports = (pairs: readonly CollisionPair[]): CollisionReport[] => {
	const byKey = new Map<string, CollisionReport>()

	for (const { a, b, depth, point } of pairs) {
		const staged = isGhost(a) || isGhost(b)
		const [first, second] = [sideOf(a), sideOf(b)].toSorted(compareSides)
		if (first === undefined || second === undefined) continue

		const key = `${staged ? 'staged' : 'live'}:${first.name}-${second.name}`
		const existing = byKey.get(key)
		if (existing && existing.depth >= depth) continue
		byKey.set(key, { key, a: first, b: second, staged, depth, point })
	}

	// Staged pairs first: a move that would collide is the more urgent warning.
	return [...byKey.values()].toSorted((x, y) => Number(y.staged) - Number(x.staged))
}
