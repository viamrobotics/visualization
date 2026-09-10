import { Quaternion, Vector3 } from 'three'
import { describe, expect, it } from 'vitest'

import { OrientationVector } from '$lib/math/OrientationVector'

import { arrowMatrix, planeMatrix } from '../matrix'

const worldPosition = (matrix: ReturnType<typeof arrowMatrix>): Vector3 =>
	new Vector3(0, 0, 0).applyMatrix4(matrix)

/**
 * The direction `BatchedArrows` renders for an arrow entity: it decomposes the world matrix
 * and reads the orientation vector, which is the rotated +Z axis.
 */
const renderedDirection = (matrix: ReturnType<typeof arrowMatrix>): Vector3 => {
	const quaternion = new Quaternion()
	matrix.decompose(new Vector3(), quaternion, new Vector3())
	const orientation = new OrientationVector().setFromQuaternion(quaternion)
	return new Vector3(orientation.x, orientation.y, orientation.z)
}

const expectDirection = (actual: Vector3, expected: Vector3) => {
	expect(actual.x).toBeCloseTo(expected.x)
	expect(actual.y).toBeCloseTo(expected.y)
	expect(actual.z).toBeCloseTo(expected.z)
}

const worldZAxis = (matrix: ReturnType<typeof planeMatrix>): Vector3 =>
	new Vector3(0, 0, 1).transformDirection(matrix)

describe('arrowMatrix', () => {
	it('places the gizmo at the supplied position', () => {
		const matrix = arrowMatrix('y', new Vector3(1, 2, 3), undefined)
		expect(worldPosition(matrix).equals(new Vector3(1, 2, 3))).toBe(true)
	})

	it('renders along world +X for axis "x"', () => {
		const matrix = arrowMatrix('x', new Vector3(), undefined)
		expectDirection(renderedDirection(matrix), new Vector3(1, 0, 0))
	})

	it('renders along world +Y for axis "y"', () => {
		const matrix = arrowMatrix('y', new Vector3(), undefined)
		expectDirection(renderedDirection(matrix), new Vector3(0, 1, 0))
	})

	it('renders along world +Z for axis "z"', () => {
		const matrix = arrowMatrix('z', new Vector3(), undefined)
		expectDirection(renderedDirection(matrix), new Vector3(0, 0, 1))
	})

	it('renders along the supplied surface normal when axis is "surface"', () => {
		const normal = new Vector3(1, 1, 0).normalize()
		const matrix = arrowMatrix('surface', new Vector3(), normal)
		expectDirection(renderedDirection(matrix), normal)
	})

	it('renders along a surface normal that points straight down', () => {
		const matrix = arrowMatrix('surface', new Vector3(), new Vector3(0, 0, -1))
		expectDirection(renderedDirection(matrix), new Vector3(0, 0, -1))
	})

	it('falls back to world +Z when axis is "surface" and no normal is supplied', () => {
		const matrix = arrowMatrix('surface', new Vector3(), undefined)
		expectDirection(renderedDirection(matrix), new Vector3(0, 0, 1))
	})

	it('returns a fresh matrix on every call', () => {
		const first = arrowMatrix('x', new Vector3(), undefined)
		const second = arrowMatrix('x', new Vector3(), undefined)
		expect(first).not.toBe(second)
	})
})

describe('planeMatrix', () => {
	it('places the plane at the supplied position', () => {
		const matrix = planeMatrix('xy', new Vector3(1, 2, 3))
		expect(worldPosition(matrix).equals(new Vector3(1, 2, 3))).toBe(true)
	})

	it('xy plane has a +Z normal', () => {
		const normal = worldZAxis(planeMatrix('xy', new Vector3()))
		expect(normal.z).toBeCloseTo(1)
	})

	it('yz plane has a normal along X', () => {
		const normal = worldZAxis(planeMatrix('yz', new Vector3()))
		expect(Math.abs(normal.x)).toBeCloseTo(1)
	})

	it('xz plane has a normal along Y', () => {
		const normal = worldZAxis(planeMatrix('xz', new Vector3()))
		expect(Math.abs(normal.y)).toBeCloseTo(1)
	})

	it('returns a fresh matrix on every call', () => {
		const first = planeMatrix('xy', new Vector3())
		const second = planeMatrix('xy', new Vector3())
		expect(first).not.toBe(second)
	})
})
