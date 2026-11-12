import type { Entity } from 'koota'

import { Box3, BufferGeometry, Vector3 } from 'three'

import { traits } from '$lib/ecs'

const MM_TO_M = 0.001

/**
 * A geometry's shape in its own frame, in metres, centred on that frame's origin. A mesh keeps
 * its local bounds, which need not be centred.
 */
export type SnapShape =
	| { kind: 'box'; halfSize: Vector3 }
	| { kind: 'sphere'; radius: number }
	| { kind: 'capsule'; radius: number; length: number }
	| { kind: 'cylinder'; radius: number; length: number }
	| { kind: 'mesh'; geometry: BufferGeometry; bounds: Box3 }

/** The snap shape of an entity's geometry trait, or `undefined` when it has none. */
export const snapShapeOf = (entity: Entity): SnapShape | undefined => {
	const box = entity.get(traits.Box)
	if (box) {
		return {
			kind: 'box',
			halfSize: new Vector3(box.x, box.y, box.z).multiplyScalar(MM_TO_M / 2),
		}
	}

	const sphere = entity.get(traits.Sphere)
	if (sphere) return { kind: 'sphere', radius: sphere.r * MM_TO_M }

	const capsule = entity.get(traits.Capsule)
	if (capsule) {
		return { kind: 'capsule', radius: capsule.r * MM_TO_M, length: capsule.l * MM_TO_M }
	}

	const cylinder = entity.get(traits.Cylinder)
	if (cylinder) {
		return { kind: 'cylinder', radius: cylinder.r * MM_TO_M, length: cylinder.l * MM_TO_M }
	}

	// A point cloud also stores its points as a `BufferGeometry`, but it has no surface.
	if (entity.has(traits.Points)) return

	const geometry = entity.get(traits.BufferGeometry)
	if (!geometry || (geometry.getAttribute('position')?.count ?? 0) === 0) return

	if (geometry.boundingBox === null) geometry.computeBoundingBox()
	if (geometry.boundingBox === null) return

	return { kind: 'mesh', geometry, bounds: geometry.boundingBox }
}
