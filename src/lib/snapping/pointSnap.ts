import { Matrix4, Vector2, Vector3 } from 'three'

import type { SnapQuery, SnapResult } from './snapQuery'

import { constrainDelta } from './dragConstraint'
import { geometryKeyPoints } from './geometryKeyPoints'

/** How close the cursor has to come to a key point, in canvas pixels, for it to catch. */
export const SNAP_RADIUS_PX = 12

const UNIT_SCALE = new Vector3(1, 1, 1)
const screenPoint = new Vector2()
const geometryMatrix = new Matrix4()

// Points this close together on screen read as one spot to the user, so depth decides between them.
const SCREEN_TIE_PX = 0.5

/**
 * The target key point nearest the cursor on screen, within {@link SNAP_RADIUS_PX}. Of points that
 * overlap on screen, such as a box's top and bottom corners seen from above, the one nearer the
 * camera wins.
 */
const nearestTargetPoint = (query: SnapQuery): Vector3 | undefined => {
	let nearest: Vector3 | undefined
	let nearestPixels = SNAP_RADIUS_PX
	let nearestDepth = Infinity

	for (const target of query.targets) {
		for (const point of geometryKeyPoints(target.shape, target.matrix)) {
			if (!query.toScreen(point, screenPoint)) continue

			const pixels = screenPoint.distanceTo(query.cursor)
			if (pixels > SNAP_RADIUS_PX) continue

			const depth = point.distanceTo(query.ray.origin)
			const isTie = nearest !== undefined && Math.abs(pixels - nearestPixels) <= SCREEN_TIE_PX
			if (isTie ? depth >= nearestDepth : pixels > nearestPixels) continue

			nearest = point
			nearestPixels = pixels
			nearestDepth = depth
		}
	}

	return nearest
}

/** The dragged geometries' key points at the gizmo's position, or its origin when it has none. */
const sourcePoints = (query: SnapQuery): Vector3[] => {
	if (query.dragged.length === 0) return [query.position.clone()]

	return query.dragged.flatMap(({ shape, anchorToGeometry }) => {
		geometryMatrix.compose(query.position, query.orientation, UNIT_SCALE).multiply(anchorToGeometry)
		return geometryKeyPoints(shape, geometryMatrix)
	})
}

/**
 * Lands the dragged entity's nearest key point on the target key point under the cursor. Returns
 * `null` when no target point is within reach.
 */
export const pointSnap = (query: SnapQuery): SnapResult | null => {
	const target = nearestTargetPoint(query)
	if (!target) return null

	let source = query.position
	let sourceDistance = Infinity
	for (const point of sourcePoints(query)) {
		const distance = point.distanceTo(target)
		if (distance >= sourceDistance) continue
		source = point
		sourceDistance = distance
	}

	const delta = constrainDelta(target.clone().sub(source), query.constraint)

	return {
		position: query.position.clone().add(delta),
		orientation: query.orientation.clone(),
		indicator: { kind: 'point', point: target },
	}
}
