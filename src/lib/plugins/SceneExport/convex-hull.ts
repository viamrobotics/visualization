import { type BufferGeometry, Vector3 } from 'three'
import { ConvexGeometry } from 'three/addons/geometries/ConvexGeometry.js'

/** The convex hull of `geometry`'s vertices, in the same frame. */
export const convexHull = (geometry: BufferGeometry): BufferGeometry => {
	const position = geometry.getAttribute('position')
	const points: Vector3[] = []
	for (let index = 0; index < position.count; index++) {
		points.push(new Vector3().fromBufferAttribute(position, index))
	}
	return new ConvexGeometry(points)
}
