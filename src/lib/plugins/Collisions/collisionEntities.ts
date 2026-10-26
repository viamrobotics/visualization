import type { Entity, World } from 'koota'

import { traits } from '$lib/ecs'

import type { CollisionReport } from './collisionReport'

import { CollidesWith } from './relations'
import { Collision } from './traits'

/** The world tree row for a pair. A staged pair is labelled apart from a live one with the same names. */
export const collisionLabel = (report: CollisionReport): string => {
	const label = `${report.a.name} ↔ ${report.b.name}`
	return report.staged ? `${label} (after move)` : label
}

const collisionValues = ({ staged, depth, point }: CollisionReport) => ({
	staged,
	depth,
	x: point.x,
	y: point.y,
	z: point.z,
})

/** Points the pair at the report's sides, which can change while the names stay the same. */
const linkSides = (pair: Entity, report: CollisionReport) => {
	const sides = new Set([report.a.entity, report.b.entity])

	for (const target of pair.targetsFor(CollidesWith)) {
		if (!sides.has(target)) pair.remove(CollidesWith(target))
	}

	for (const side of sides) {
		if (!pair.has(CollidesWith(side))) pair.add(CollidesWith(side))
	}
}

/**
 * Keeps one entity per reported pair, so the world tree can list it and selecting it can open its
 * details. A pair keeps its entity while its names keep overlapping, which keeps the row, and any
 * selection on it, steady as the colliders move.
 */
export const createCollisionEntities = (world: World) => {
	const pairs = new Map<string, Entity>()

	return {
		sync(reports: readonly CollisionReport[]): void {
			const seen = new Set<string>()

			for (const report of reports) {
				seen.add(report.key)

				// A side's destruction takes the pair with it through `autoDestroy`, so a stored entity can be dead.
				const existing = pairs.get(report.key)
				const pair = existing?.isAlive()
					? existing
					: world.spawn(traits.Name(collisionLabel(report)), Collision)

				pair.set(Collision, collisionValues(report))
				linkSides(pair, report)
				pairs.set(report.key, pair)
			}

			for (const [key, pair] of pairs) {
				if (seen.has(key)) continue
				if (pair.isAlive()) pair.destroy()
				pairs.delete(key)
			}
		},

		clear(): void {
			for (const pair of pairs.values()) {
				if (pair.isAlive()) pair.destroy()
			}
			pairs.clear()
		},
	}
}
