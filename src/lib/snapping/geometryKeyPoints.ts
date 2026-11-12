import { type Matrix4, Vector3 } from 'three'

import type { SnapShape } from './snapShape'

const boxCenter = new Vector3()
const boxHalfSize = new Vector3()

/**
 * Every corner, edge midpoint, and face centre of a box: the 26 sign combinations of its
 * half-size, leaving out the all-zero centre.
 */
const pushBoxPoints = (center: Vector3, halfSize: Vector3, out: Vector3[]) => {
	for (const x of [-1, 0, 1]) {
		for (const y of [-1, 0, 1]) {
			for (const z of [-1, 0, 1]) {
				if (x === 0 && y === 0 && z === 0) continue
				out.push(new Vector3(x * halfSize.x, y * halfSize.y, z * halfSize.z).add(center))
			}
		}
	}
}

/** The centre, and the two ends of the shape's +Z axis. */
const pushAxisPoints = (halfLength: number, out: Vector3[]) => {
	out.push(new Vector3(), new Vector3(0, 0, halfLength), new Vector3(0, 0, -halfLength))
}

/**
 * A geometry's snap points in world space. A box, or a mesh through its local bounds, gives its
 * corners, edge midpoints, and face centres. A sphere gives its centre. A capsule or cylinder gives
 * its centre and the two ends of its axis.
 *
 * @param matrix The geometry's local-to-world transform.
 */
export const geometryKeyPoints = (shape: SnapShape, matrix: Matrix4): Vector3[] => {
	const points: Vector3[] = []

	switch (shape.kind) {
		case 'box': {
			pushBoxPoints(boxCenter.set(0, 0, 0), shape.halfSize, points)
			break
		}
		case 'mesh': {
			shape.bounds.getCenter(boxCenter)
			shape.bounds.getSize(boxHalfSize).multiplyScalar(0.5)
			pushBoxPoints(boxCenter, boxHalfSize, points)
			break
		}
		case 'sphere': {
			points.push(new Vector3())
			break
		}
		case 'capsule':
		case 'cylinder': {
			pushAxisPoints(shape.length / 2, points)
			break
		}
		default: {
			shape satisfies never
		}
	}

	for (const point of points) point.applyMatrix4(matrix)

	return points
}
