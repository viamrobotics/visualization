import type { Entity } from 'koota'

import { Matrix4, Vector3 } from 'three'

import { traits } from '$lib/ecs'
import { Pose } from '$lib/math'

const tempPose = new Pose()
const centerMatrix = new Matrix4()
const scale = new Vector3()

const MM_TO_M = 0.001

/**
 * Compose a cylinder entity's full render transform into `out`:
 * `WorldMatrix × Center pose × (r, r, l)` in meters. The shared unit cylinder is
 * radius 1 and height 1 about Z, so the radial scale is `r` rather than the
 * diameter, and the axial scale is the full length.
 *
 * Returns `false` (leaving `out` untouched) when the entity is missing the
 * traits needed to place a cylinder.
 */
export const composeCylinderMatrix = (entity: Entity, out: Matrix4): boolean => {
	const cylinder = entity.get(traits.Cylinder)
	const worldMatrix = entity.get(traits.WorldMatrix)

	if (!cylinder || !worldMatrix) {
		return false
	}

	out.copy(worldMatrix)

	const center = entity.get(traits.Center)
	if (center) {
		out.multiply(tempPose.copy(center).toMatrix4(centerMatrix))
	}

	const radius = cylinder.r * MM_TO_M
	out.scale(scale.set(radius, radius, cylinder.l * MM_TO_M))

	return true
}

/**
 * Compose a cylinder's selection-bounds transform into `out`:
 * `WorldMatrix × Center pose × (2r, 2r, l)` in meters. The cylinder's local AABB
 * is ±r radially and ±l/2 axially, so scaling the `OBBHelper`'s unit box (±0.5)
 * by these extents wraps it. `capped` does not enter: an open tube occupies the
 * same box as a solid one.
 *
 * Returns `false` (leaving `out` untouched) when the entity is missing the
 * traits needed to place a cylinder.
 */
export const composeCylinderBoundsMatrix = (entity: Entity, out: Matrix4): boolean => {
	const cylinder = entity.get(traits.Cylinder)
	const worldMatrix = entity.get(traits.WorldMatrix)

	if (!cylinder || !worldMatrix) {
		return false
	}

	out.copy(worldMatrix)

	const center = entity.get(traits.Center)
	if (center) {
		out.multiply(tempPose.copy(center).toMatrix4(centerMatrix))
	}

	const diameter = 2 * cylinder.r * MM_TO_M
	out.scale(scale.set(diameter, diameter, cylinder.l * MM_TO_M))

	return true
}
