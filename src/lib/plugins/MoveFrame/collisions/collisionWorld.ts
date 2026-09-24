import type RAPIER from '@dimforge/rapier3d-compat'
import type { Entity } from 'koota'

import { Quaternion, Vector3 } from 'three'

import { type ColliderShape, colliderShapeFor, composeColliderPose } from './colliderShape'
import { groupsForBit } from './interactionGroups'

/** An entity to collide, and the group bit that decides what it tests against. */
export interface CollisionMember {
	entity: Entity
	bit: number
}

/** Two entities whose colliders overlap. Order within a pair is not meaningful. */
export interface CollisionPair {
	a: Entity
	b: Entity
}

interface Tracked {
	collider: RAPIER.Collider
	shape: ColliderShape
	bit: number
}

const position = new Vector3()
const quaternion = new Quaternion()

const sameShape = (a: ColliderShape, b: ColliderShape): boolean => {
	if (a.kind === 'cuboid' && b.kind === 'cuboid') {
		return a.hx === b.hx && a.hy === b.hy && a.hz === b.hz
	}
	if (a.kind === 'ball' && b.kind === 'ball') return a.radius === b.radius
	if (a.kind === 'capsule' && b.kind === 'capsule') {
		return a.halfHeight === b.halfHeight && a.radius === b.radius
	}
	if (a.kind === 'cylinder' && b.kind === 'cylinder') {
		return a.halfHeight === b.halfHeight && a.radius === b.radius
	}
	return false
}

const describeShape = (rapier: typeof RAPIER, shape: ColliderShape): RAPIER.ColliderDesc => {
	switch (shape.kind) {
		case 'cuboid': {
			return rapier.ColliderDesc.cuboid(shape.hx, shape.hy, shape.hz)
		}
		case 'ball': {
			return rapier.ColliderDesc.ball(shape.radius)
		}
		case 'capsule': {
			return rapier.ColliderDesc.capsule(shape.halfHeight, shape.radius)
		}
		case 'cylinder': {
			return rapier.ColliderDesc.cylinder(shape.halfHeight, shape.radius)
		}
	}
}

/**
 * Sensor colliders for the collidable entities in the scene, living inside a
 * Rapier world owned by `<World>` from `@threlte/rapier`.
 *
 * The world is borrowed, never freed here — `<World>` owns its lifecycle, and
 * other features are expected to put their own bodies in it. `dispose` removes
 * only the colliders this module created.
 *
 * Colliders are parentless: no rigid bodies, because nothing is simulated.
 * Poses are written straight from the scene's `WorldMatrix` on every sync, and
 * `step()` runs only to populate the narrow phase so intersections read back.
 *
 * Two Rapier defaults must be overridden or nothing is ever reported.
 * `setSensor(true)` makes overlaps surface as intersection pairs rather than
 * contacts to resolve, and `FIXED_FIXED` has to be requested by name — Rapier
 * skips fixed-vs-fixed pairs by default, and `ActiveCollisionTypes.ALL` does
 * not actually include it (see `create`).
 */
export const createCollisionWorld = (rapier: typeof RAPIER, world: RAPIER.World) => {
	const tracked = new Map<Entity, Tracked>()
	const entityByHandle = new Map<number, Entity>()

	const remove = (entity: Entity, entry: Tracked) => {
		entityByHandle.delete(entry.collider.handle)
		world.removeCollider(entry.collider, false)
		tracked.delete(entity)
	}

	const create = (entity: Entity, shape: ColliderShape, bit: number) => {
		const desc = describeShape(rapier, shape)
			.setTranslation(position.x, position.y, position.z)
			.setRotation(quaternion)
			.setSensor(true)
			// `ALL` is a misnomer — it is DEFAULT | KINEMATIC_KINEMATIC | KINEMATIC_FIXED
			// and leaves FIXED_FIXED out (60943 & 32 === 0). Every collider here is
			// parentless, which Rapier treats as fixed, so without this every pair is
			// rejected before narrow phase and nothing is ever reported.
			.setActiveCollisionTypes(
				rapier.ActiveCollisionTypes.ALL | rapier.ActiveCollisionTypes.FIXED_FIXED
			)
			.setCollisionGroups(groupsForBit(bit))

		const collider = world.createCollider(desc)
		tracked.set(entity, { collider, shape, bit })
		entityByHandle.set(collider.handle, entity)
	}

	return {
		/**
		 * Reconcile the collider set against `members`: add what is new, move what
		 * moved, drop what is gone. Entities with no collidable primitive, no
		 * `WorldMatrix`, or degenerate geometry are skipped.
		 *
		 * A collider is reused whenever its shape and group bit are unchanged, so a
		 * moving arm rewrites poses rather than rebuilding Rapier shapes.
		 */
		sync(members: Iterable<CollisionMember>): void {
			const seen = new Set<Entity>()

			for (const { entity, bit } of members) {
				if (!entity.isAlive()) continue

				const shape = colliderShapeFor(entity)
				if (!shape) continue
				if (!composeColliderPose(entity, shape, position, quaternion)) continue

				seen.add(entity)
				const existing = tracked.get(entity)

				if (existing && existing.bit === bit && sameShape(existing.shape, shape)) {
					existing.collider.setTranslation(position)
					existing.collider.setRotation(quaternion)
					continue
				}

				if (existing) remove(entity, existing)
				create(entity, shape, bit)
			}

			for (const [entity, entry] of tracked) {
				if (!seen.has(entity)) remove(entity, entry)
			}
		},

		/**
		 * Step the pipeline and read back every overlapping pair.
		 *
		 * Each pair is reported once: the walk visits every collider, and a pair is
		 * recorded only from the side holding the lower handle.
		 */
		detect(): CollisionPair[] {
			world.step()

			const pairs: CollisionPair[] = []
			for (const [entity, entry] of tracked) {
				world.intersectionPairsWith(entry.collider, (other) => {
					if (other.handle < entry.collider.handle) return
					const b = entityByHandle.get(other.handle)
					if (b === undefined || b === entity) return
					pairs.push({ a: entity, b })
				})
			}
			return pairs
		},

		/** Remove this module's colliders. The world itself belongs to `<World>`. */
		dispose(): void {
			for (const [entity, entry] of tracked) remove(entity, entry)
			tracked.clear()
			entityByHandle.clear()
		},
	}
}

export type CollisionWorld = ReturnType<typeof createCollisionWorld>
