import { Vector3 } from 'three'
import { describe, expect, it } from 'vitest'

import { arrowMatrix, planeMatrix } from '../matrix'

const worldPosition = (matrix: ReturnType<typeof arrowMatrix>): Vector3 =>
	new Vector3(0, 0, 0).applyMatrix4(matrix)

const worldYAxis = (matrix: ReturnType<typeof arrowMatrix>): Vector3 =>
	new Vector3(0, 1, 0).transformDirection(matrix)

const worldZAxis = (matrix: ReturnType<typeof planeMatrix>): Vector3 =>
	new Vector3(0, 0, 1).transformDirection(matrix)

describe('arrowMatrix', () => {
	it('places the gizmo at the supplied position', () => {
		const matrix = arrowMatrix('y', new Vector3(1, 2, 3), undefined)
		expect(worldPosition(matrix).equals(new Vector3(1, 2, 3))).toBe(true)
	})

	it('orients the local +Y axis opposite the x world axis', () => {
		const matrix = arrowMatrix('x', new Vector3(), undefined)
		const localY = worldYAxis(matrix)
		expect(localY.x).toBeCloseTo(-1)
		expect(localY.y).toBeCloseTo(0)
		expect(localY.z).toBeCloseTo(0)
	})

	it('orients the local +Y axis opposite the z world axis', () => {
		const matrix = arrowMatrix('z', new Vector3(), undefined)
		const localY = worldYAxis(matrix)
		expect(localY.z).toBeCloseTo(-1)
	})

	it('orients the local +Y axis opposite world +Y', () => {
		const matrix = arrowMatrix('y', new Vector3(), undefined)
		const localY = worldYAxis(matrix)
		expect(localY.y).toBeCloseTo(-1)
	})

	it('uses the supplied surface normal when axis is "surface"', () => {
		const matrix = arrowMatrix('surface', new Vector3(), new Vector3(0, 0, 1))
		const localY = worldYAxis(matrix)
		expect(localY.z).toBeCloseTo(-1)
	})

	it('falls back to world +Z when axis is "surface" and no normal is supplied', () => {
		const matrix = arrowMatrix('surface', new Vector3(), undefined)
		const localY = worldYAxis(matrix)
		expect(localY.z).toBeCloseTo(-1)
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
