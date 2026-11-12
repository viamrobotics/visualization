import { type Matrix4, Vector3 } from 'three'

import type { SnapShape } from './snapShape'

const axisX = new Vector3()
const axisY = new Vector3()
const axisZ = new Vector3()
const localCenter = new Vector3()
const halfSize = new Vector3()

/** Reads the basis that `supportDistance` extracted into `axisX`, `axisY`, `axisZ`. */
const boxSupport = (half: Vector3, direction: Vector3): number =>
	half.x * Math.abs(axisX.dot(direction)) +
	half.y * Math.abs(axisY.dot(direction)) +
	half.z * Math.abs(axisZ.dot(direction))

/**
 * How far a geometry reaches from its origin in `direction`: the largest `(p − origin) · direction`
 * over every point `p` of the shape. Setting a shape down on a plane with normal `n` puts its
 * origin `supportDistance(shape, matrix, −n)` above that plane.
 *
 * @param matrix The geometry's local-to-world transform, without scale.
 * @param direction A unit vector in world space.
 */
export const supportDistance = (shape: SnapShape, matrix: Matrix4, direction: Vector3): number => {
	matrix.extractBasis(axisX, axisY, axisZ)

	switch (shape.kind) {
		case 'box': {
			return boxSupport(shape.halfSize, direction)
		}
		case 'mesh': {
			shape.bounds.getCenter(localCenter)
			shape.bounds.getSize(halfSize).multiplyScalar(0.5)
			const centerReach =
				localCenter.x * axisX.dot(direction) +
				localCenter.y * axisY.dot(direction) +
				localCenter.z * axisZ.dot(direction)
			return centerReach + boxSupport(halfSize, direction)
		}
		case 'sphere': {
			return shape.radius
		}
		case 'capsule': {
			const segmentHalfLength = Math.max(0, shape.length / 2 - shape.radius)
			return segmentHalfLength * Math.abs(axisZ.dot(direction)) + shape.radius
		}
		case 'cylinder': {
			const alongAxis = Math.abs(axisZ.dot(direction))
			const acrossAxis = Math.sqrt(Math.max(0, 1 - alongAxis * alongAxis))
			return (shape.length / 2) * alongAxis + shape.radius * acrossAxis
		}
		default: {
			return shape satisfies never
		}
	}
}
