import { Plane, type Ray, Vector3 } from 'three'

import type { SnapTarget } from './snapQuery'

import { raycastSnapShape, type SnapHit } from './raycastSnapShape'

const GROUND_PLANE = new Plane(new Vector3(0, 0, 1), 0)

const groundHit = (ray: Ray): SnapHit | null => {
	// Only from above. Seen from below, the ground is not a surface anything rests on.
	if (ray.direction.z >= 0) return null

	const point = ray.intersectPlane(GROUND_PLANE, new Vector3())
	if (!point) return null

	return { point, normal: new Vector3(0, 0, 1), distance: point.distanceTo(ray.origin) }
}

/**
 * The first surface a ray meets among the targets, and the ground when `groundPlane` is set.
 * Returns `null` when it meets none.
 */
export const nearestSurfaceHit = (
	ray: Ray,
	targets: SnapTarget[],
	groundPlane: boolean
): SnapHit | null => {
	let nearest = groundPlane ? groundHit(ray) : null

	for (const target of targets) {
		const hit = raycastSnapShape(ray, target.shape, target.matrix)
		if (hit && (!nearest || hit.distance < nearest.distance)) nearest = hit
	}

	return nearest
}
