import type { Entity } from 'koota'

import { Matrix4, Vector3 } from 'three'

import { traits } from '$lib/ecs'
import { Pose } from '$lib/math'

const tempPose = new Pose()
const centerMatrix = new Matrix4()
const scale = new Vector3()

const MM_TO_M = 0.001

/**
 * Compose a sphere entity's full render transform into `out`:
 * `WorldMatrix × Center pose × uniform radius scale (mm → m)` — the same
 * composition the per-entity path produced by nesting a radius-scaled,
 * center-offset mesh inside a `WorldMatrix`-driven group. The shared unit sphere
 * has radius 1, so the scale is the radius `r`, not the diameter.
 *
 * Returns `false` (leaving `out` untouched) when the entity is missing the
 * traits needed to place a sphere.
 */
export const composeSphereMatrix = (entity: Entity, out: Matrix4): boolean => {
	const sphere = entity.get(traits.Sphere)
	const worldMatrix = entity.get(traits.WorldMatrix)

	if (!sphere || !worldMatrix) {
		return false
	}

	out.copy(worldMatrix)

	const center = entity.get(traits.Center)
	if (center) {
		out.multiply(tempPose.copy(center).toMatrix4(centerMatrix))
	}

	out.scale(scale.setScalar(sphere.r * MM_TO_M))

	return true
}

/**
 * Compose a sphere's selection-bounds transform into `out`:
 * `WorldMatrix × Center pose × (2r, 2r, 2r)` in meters. The sphere's local AABB
 * is ±r on every axis, so scaling the `OBBHelper`'s unit box (±0.5) by the
 * diameter `2r` wraps it. This mirrors how `composeCapsuleBoundsMatrix` sizes a
 * capsule's bounds apart from its render parts: the render transform scales the
 * unit sphere by the radius `r`, the bounds scale the unit box by the diameter
 * `2r`.
 *
 * Returns `false` (leaving `out` untouched) when the entity is missing the
 * traits needed to place a sphere.
 */
export const composeSphereBoundsMatrix = (entity: Entity, out: Matrix4): boolean => {
	const sphere = entity.get(traits.Sphere)
	const worldMatrix = entity.get(traits.WorldMatrix)

	if (!sphere || !worldMatrix) {
		return false
	}

	out.copy(worldMatrix)

	const center = entity.get(traits.Center)
	if (center) {
		out.multiply(tempPose.copy(center).toMatrix4(centerMatrix))
	}

	out.scale(scale.setScalar(2 * sphere.r * MM_TO_M))

	return true
}
