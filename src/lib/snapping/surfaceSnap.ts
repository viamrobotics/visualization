import { Matrix4, Quaternion, Vector3 } from 'three'

import type { SnapQuery, SnapResult } from './snapQuery'

import { alignUpToNormal } from './alignUpToNormal'
import { constrainDelta } from './dragConstraint'
import { nearestSurfaceHit } from './nearestSurfaceHit'
import { supportDistance } from './supportDistance'

// Below this, the constraint leaves almost none of the surface normal to move along, so reaching
// the surface would fling the object far down the axis.
const MIN_NORMAL_ALIGNMENT = 0.1

const UNIT_SCALE = new Vector3(1, 1, 1)
const geometryMatrix = new Matrix4()
const geometryOrigin = new Vector3()
const downward = new Vector3()

/** How far the dragged geometries reach from the anchor in `direction`, taken together. */
const reachFromAnchor = (query: SnapQuery, orientation: Quaternion, direction: Vector3): number => {
	let reach = -Infinity

	for (const { shape, anchorToGeometry } of query.dragged) {
		geometryMatrix.compose(query.position, orientation, UNIT_SCALE).multiply(anchorToGeometry)
		const originReach = geometryOrigin
			.setFromMatrixPosition(geometryMatrix)
			.sub(query.position)
			.dot(direction)
		reach = Math.max(reach, originReach + supportDistance(shape, geometryMatrix, direction))
	}

	return reach
}

/**
 * Sets the dragged geometry down on the surface under the cursor, touching it without sinking in.
 * Returns `null` when the entity has no geometry, the cursor is over no surface, or the drag
 * constraint cannot move toward the surface.
 */
export const surfaceSnap = (query: SnapQuery): SnapResult | null => {
	if (query.dragged.length === 0) return null

	const hit = nearestSurfaceHit(query.ray, query.targets, query.groundPlane)
	if (!hit) return null

	const orientation = query.alignRotation
		? alignUpToNormal(query.orientation, hit.normal, new Quaternion())
		: query.orientation.clone()

	const reach = reachFromAnchor(query, orientation, downward.copy(hit.normal).negate())
	// How far the lowest point sits above the surface plane. Negative means sunk in.
	const clearance = query.position.clone().sub(hit.point).dot(hit.normal) - reach

	let delta: Vector3
	if (query.constraint.kind === 'free') {
		// Free drags land over the hit point, so the object follows the cursor across the surface.
		delta = hit.point.clone().addScaledVector(hit.normal, reach).sub(query.position)
	} else {
		const direction = constrainDelta(hit.normal.clone(), query.constraint)
		if (direction.length() < MIN_NORMAL_ALIGNMENT) return null
		direction.normalize()
		delta = direction.multiplyScalar(-clearance / direction.dot(hit.normal))
	}

	return {
		position: query.position.clone().add(delta),
		orientation,
		indicator: { kind: 'surface', point: hit.point, normal: hit.normal },
	}
}
