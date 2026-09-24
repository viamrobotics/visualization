import type { Entity } from 'koota'

import { Matrix4, Vector3 } from 'three'

import { traits } from '$lib/ecs'
import { Pose } from '$lib/math'

const tempPose = new Pose()
const centerMatrix = new Matrix4()
const dimensions = new Vector3()

const MM_TO_M = 0.001

/**
 * Compose a box entity's full render transform into `out`:
 * `WorldMatrix × Center pose × box dimensions (mm → m)` — the same
 * composition the per-entity path produced by nesting a dimension-scaled,
 * center-offset mesh inside a `WorldMatrix`-driven group.
 *
 * Returns `false` (leaving `out` untouched) when the entity is missing the
 * traits needed to place a box.
 */
export const composeBoxMatrix = (entity: Entity, out: Matrix4): boolean => {
	const box = entity.get(traits.Box)
	const worldMatrix = entity.get(traits.WorldMatrix)

	if (!box || !worldMatrix) {
		return false
	}

	out.copy(worldMatrix)

	const center = entity.get(traits.Center)
	if (center) {
		out.multiply(tempPose.copy(center).toMatrix4(centerMatrix))
	}

	out.scale(dimensions.set(box.x * MM_TO_M, box.y * MM_TO_M, box.z * MM_TO_M))

	return true
}
