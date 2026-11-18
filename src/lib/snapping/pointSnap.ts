import { Matrix4, Ray, Vector2, Vector3 } from 'three'

import type { SnapQuery, SnapResult } from './snapQuery'

import { constrainDelta } from './dragConstraint'
import { geometryKeyPoints } from './geometryKeyPoints'
import { nearestSurfaceHit } from './nearestSurfaceHit'

/** How close the cursor has to come to a key point, in canvas pixels, for it to catch. */
export const SNAP_RADIUS_PX = 12

const UNIT_SCALE = new Vector3(1, 1, 1)
const screenPoint = new Vector2()
const geometryMatrix = new Matrix4()
const sightLine = new Ray()
const toPoint = new Vector3()

// Points this close together on screen read as one spot to the user, so depth decides between them.
const SCREEN_TIE_PX = 0.5

// A key point sits on its own geometry's surface, so the sight line to it can meet that surface a
// hair before the point. Only a surface further in front than this hides it.
const OCCLUSION_TOLERANCE_M = 0.001

/** Whether a surface stands between the camera and `point`, so the user cannot see it. */
const isHidden = (query: SnapQuery, point: Vector3): boolean => {
	query.rayThrough(point, sightLine)
	const pointDistance = toPoint.copy(point).sub(sightLine.origin).dot(sightLine.direction)
	const hit = nearestSurfaceHit(sightLine, query.targets, query.groundPlane)
	return hit !== null && hit.distance < pointDistance - OCCLUSION_TOLERANCE_M
}

/**
 * The visible target key point nearest the cursor on screen, within {@link SNAP_RADIUS_PX}. A point
 * behind a surface is skipped, since the user is pointing at the surface, not through it. Of points
 * that overlap on screen, the one nearer the camera wins.
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
			// Last, since it casts a ray against every target. Few points get this far.
			if (isHidden(query, point)) continue

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
