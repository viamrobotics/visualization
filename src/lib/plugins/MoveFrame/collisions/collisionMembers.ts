import type { Entity, World } from 'koota'

import { hierarchy, traits } from '$lib/ecs'

import type { CollisionMember } from './collisionWorld'

import { GhostOf } from '../relations'
import { PreviewGhost } from '../traits'
import { ENVIRONMENT_BIT } from './interactionGroups'

/** Cycle guard for the parent walk, mirroring `recomputeWorldMatrix`. */
const MAX_DEPTH = 64

/**
 * Viam's collider primitives. Meshes and point clouds are excluded — Rapier's
 * trimesh-vs-trimesh case produces no contacts, so including them would look
 * supported while reporting nothing.
 */
const COLLIDABLE = [traits.Box, traits.Capsule, traits.Cylinder, traits.Sphere] as const

/**
 * The group bit of the arm that owns `entity`, or `ENVIRONMENT_BIT` when
 * nothing above it is an arm.
 *
 * An arm's colliders are its kinematics link frames, so the walk climbs the link
 * chain before reaching the frame named after the component. It continues past
 * that too, because a gripper is its own component: its colliders hang off the
 * gripper frame, which is mounted on the arm. Stopping at the direct parent
 * would put the gripper in the environment and report it hitting the flange it
 * is bolted to.
 */
export const armBitFor = (entity: Entity, armBits: ReadonlyMap<string, number>): number => {
	let current: Entity | undefined = entity

	for (let depth = 0; current !== undefined && depth < MAX_DEPTH; depth += 1) {
		if (!current.isAlive()) break

		const name = current.get(traits.Name)
		if (name !== undefined) {
			const bit = armBits.get(name)
			if (bit !== undefined) return bit
		}

		current = hierarchy.getParentEntity(current)
	}

	return ENVIRONMENT_BIT
}

/**
 * Whether the entity stands in for something rather than being it: a staged-move ghost points at
 * the entity it copies, a preview twin is a future moment of one.
 *
 * A preview twin needs no `GhostOf`. It sits in the hierarchy under the live frame its plan hangs
 * off, so `armBitFor` already walks into the live chain and finds the arm that owns it.
 */
export const isGhost = (entity: Entity): boolean =>
	entity.targetFor(GhostOf) !== undefined || entity.has(PreviewGhost)

/**
 * Every collidable entity in the scene, paired with the group bit that decides
 * what it tests against.
 *
 * Invisible entities are left out — hiding geometry is a statement that it
 * shouldn't be considered. `ColliderHidden` entities stay in: that flag only
 * means a CAD model is drawn in place of the collider, which is still there.
 *
 * A ghost takes its source's bit, so a previewed gripper keeps testing against
 * the environment and keeps ignoring the arm it hangs off.
 */
export const collectMembers = (
	world: World,
	armBits: ReadonlyMap<string, number>
): CollisionMember[] => {
	const members: CollisionMember[] = []
	const seen = new Set<Entity>()
	const bitCache = new Map<Entity, number>()

	const bitFor = (entity: Entity): number => {
		const cached = bitCache.get(entity)
		if (cached !== undefined) return cached

		// One hop only — a ghost's source is never itself a ghost, and resolving
		// through a chain would need a cycle guard for no gain.
		const source = entity.targetFor(GhostOf)
		const subject = source?.isAlive() ? source : entity

		const bit = armBitFor(subject, armBits)
		bitCache.set(entity, bit)
		return bit
	}

	for (const trait of COLLIDABLE) {
		for (const entity of world.query(trait, traits.WorldMatrix)) {
			if (seen.has(entity) || entity.has(traits.InheritedInvisible)) continue
			seen.add(entity)
			members.push({ entity, bit: bitFor(entity) })
		}
	}

	return members
}
