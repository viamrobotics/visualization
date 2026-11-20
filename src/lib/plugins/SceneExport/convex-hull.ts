import { type BufferGeometry, Vector3 } from 'three'
import { ConvexGeometry } from 'three/addons/geometries/ConvexGeometry.js'

/**
 * Below this fraction of its bounding diagonal cubed, a hull is flat. Exactly coplanar points land
 * near 1e-17 from float noise, while a plate 0.1 mm thick across 1 m is still 3.5e-5.
 */
const FLAT_VOLUME_RATIO = 1e-9

const a = new Vector3()
const b = new Vector3()
const c = new Vector3()

/** The volume a closed, outward-wound triangle mesh encloses, as signed tetrahedra from the origin. */
const enclosedVolume = (geometry: BufferGeometry): number => {
	const position = geometry.getAttribute('position')
	let volume = 0
	for (let index = 0; index + 2 < position.count; index += 3) {
		a.fromBufferAttribute(position, index)
		b.fromBufferAttribute(position, index + 1)
		c.fromBufferAttribute(position, index + 2)
		volume += a.dot(b.cross(c)) / 6
	}
	return volume
}

/**
 * The convex hull of `geometry`'s vertices, in the same frame. `undefined` when the vertices enclose
 * no volume, as fewer than four or coplanar ones do, since physics engines cannot collide such a hull.
 */
export const convexHull = (geometry: BufferGeometry): BufferGeometry | undefined => {
	const position = geometry.getAttribute('position')
	const points: Vector3[] = []
	for (let index = 0; index < position.count; index++) {
		points.push(new Vector3().fromBufferAttribute(position, index))
	}

	const hull = new ConvexGeometry(points)
	hull.computeBoundingBox()
	const diagonal = hull.boundingBox?.getSize(a).length() ?? 0
	if (diagonal === 0 || enclosedVolume(hull) < FLAT_VOLUME_RATIO * diagonal ** 3) return undefined
	return hull
}
