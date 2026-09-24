import { createWorld, type World } from 'koota'
import { Matrix4, Quaternion, Vector3 } from 'three'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { traits } from '$lib/ecs'
import { Pose } from '$lib/math'

import { composeCapsuleBoundsMatrix, composeCapsuleMatrices } from '../composeCapsuleMatrices'

const decompose = (matrix: Matrix4) => {
	const position = new Vector3()
	const quaternion = new Quaternion()
	const scale = new Vector3()
	matrix.decompose(position, quaternion, scale)
	return { position, quaternion, scale }
}

/** Transform a local point by a matrix, returning a fresh vector. */
const apply = (matrix: Matrix4, x: number, y: number, z: number) =>
	new Vector3(x, y, z).applyMatrix4(matrix)

/**
 * Length of the matrix's z basis vector, i.e. its z-scale. Read directly
 * because `decompose()` is unreliable for a singular matrix (zero scale).
 */
const zScale = (matrix: Matrix4) => new Vector3().setFromMatrixColumn(matrix, 2).length()

describe('composeCapsuleMatrices', () => {
	let world: World
	let body: Matrix4
	let headTop: Matrix4
	let headBottom: Matrix4

	beforeEach(() => {
		world = createWorld()
		body = new Matrix4()
		headTop = new Matrix4()
		headBottom = new Matrix4()
	})
	afterEach(() => {
		world.destroy()
	})

	it('scales the body to (r, r, l − 2r) and offsets the caps by ±(l − 2r)/2', () => {
		// r = 50 mm, l = 200 mm → midsection = 100 mm, halfMid = 50 mm.
		const entity = world.spawn(
			traits.Capsule({ r: 50, l: 200 }),
			traits.WorldMatrix(new Pose(1000, 2000, 3000).toMatrix4())
		)

		expect(composeCapsuleMatrices(entity, body, headTop, headBottom)).toBe(true)

		const bodyT = decompose(body)
		// Body sits at the capsule origin, radius in x/y and midsection in z (m).
		expect(bodyT.position.x).toBeCloseTo(1)
		expect(bodyT.position.y).toBeCloseTo(2)
		expect(bodyT.position.z).toBeCloseTo(3)
		expect(bodyT.scale.x).toBeCloseTo(0.05)
		expect(bodyT.scale.y).toBeCloseTo(0.05)
		expect(bodyT.scale.z).toBeCloseTo(0.1)

		// Caps are pushed ±halfMid (0.05 m) along z and scaled uniformly by r.
		const topT = decompose(headTop)
		expect(topT.position.z).toBeCloseTo(3.05)
		expect(topT.scale.x).toBeCloseTo(0.05)
		expect(topT.scale.y).toBeCloseTo(0.05)
		expect(topT.scale.z).toBeCloseTo(0.05)

		const bottomT = decompose(headBottom)
		expect(bottomT.position.z).toBeCloseTo(2.95)
		expect(bottomT.scale.x).toBeCloseTo(0.05)
		expect(bottomT.scale.y).toBeCloseTo(0.05)
		expect(bottomT.scale.z).toBeCloseTo(0.05)
	})

	it('flips the −Z cap so the two poles span the full length l', () => {
		// The unit hemisphere pole is at local +z; after the body/cap composition
		// the two poles should sit at ±l/2 about the capsule origin (z = 3 m here).
		const entity = world.spawn(
			traits.Capsule({ r: 50, l: 200 }),
			traits.WorldMatrix(new Pose(0, 0, 3000).toMatrix4())
		)

		composeCapsuleMatrices(entity, body, headTop, headBottom)

		const topPole = apply(headTop, 0, 0, 1)
		const bottomPole = apply(headBottom, 0, 0, 1)
		// Top pole reaches +l/2 (0.1 m), bottom pole reaches −l/2, total span = l.
		expect(topPole.z).toBeCloseTo(3.1)
		expect(bottomPole.z).toBeCloseTo(2.9)
		expect(topPole.z - bottomPole.z).toBeCloseTo(0.2)
	})

	it('collapses the body to zero height when l ≤ 2r (sphere case)', () => {
		// l = 2r → no midsection: body z-scale is 0 and both caps meet at origin.
		const entity = world.spawn(traits.Capsule({ r: 100, l: 200 }), traits.WorldMatrix())

		composeCapsuleMatrices(entity, body, headTop, headBottom)

		expect(zScale(body)).toBeCloseTo(0)
		expect(decompose(headTop).position.z).toBeCloseTo(0)
		expect(decompose(headBottom).position.z).toBeCloseTo(0)
	})

	it('applies Center between WorldMatrix and the parts', () => {
		// WorldMatrix rotates 90° about Z, so the Center's +0.5 m local-x offset
		// is rotated onto world +y for every part.
		const entity = world.spawn(
			traits.Capsule({ r: 50, l: 200 }),
			traits.WorldMatrix(new Pose(0, 0, 0, 0, 0, 1, 90).toMatrix4()),
			traits.Center(new Pose(500, 0, 0))
		)

		composeCapsuleMatrices(entity, body, headTop, headBottom)

		const bodyT = decompose(body)
		expect(bodyT.position.x).toBeCloseTo(0)
		expect(bodyT.position.y).toBeCloseTo(0.5)
		expect(bodyT.position.z).toBeCloseTo(0)

		// Caps keep their ±halfMid offset along the (rotation-preserved) z axis.
		expect(decompose(headTop).position.z).toBeCloseTo(0.05)
		expect(decompose(headBottom).position.z).toBeCloseTo(-0.05)
	})

	it.each([
		['Capsule', () => world.spawn(traits.WorldMatrix(new Pose(1000, 0, 0).toMatrix4()))],
		['WorldMatrix', () => world.spawn(traits.Capsule({ r: 50, l: 200 }))],
	])('returns false and leaves the matrices untouched when %s is missing', (_missing, spawn) => {
		const entity = spawn()
		const sentinel = new Pose(9000, 9000, 9000).toMatrix4()
		body.copy(sentinel)
		headTop.copy(sentinel)
		headBottom.copy(sentinel)

		expect(composeCapsuleMatrices(entity, body, headTop, headBottom)).toBe(false)
		expect(body.equals(sentinel)).toBe(true)
		expect(headTop.equals(sentinel)).toBe(true)
		expect(headBottom.equals(sentinel)).toBe(true)
	})
})

describe('composeCapsuleBoundsMatrix', () => {
	let world: World
	let bounds: Matrix4

	beforeEach(() => {
		world = createWorld()
		bounds = new Matrix4()
	})
	afterEach(() => {
		world.destroy()
	})

	it('scales the selection bounds to (2r, 2r, l) in meters', () => {
		const entity = world.spawn(
			traits.Capsule({ r: 50, l: 200 }),
			traits.WorldMatrix(new Pose(1000, 2000, 3000).toMatrix4())
		)

		expect(composeCapsuleBoundsMatrix(entity, bounds)).toBe(true)

		const { position, quaternion, scale } = decompose(bounds)
		expect(position.x).toBeCloseTo(1)
		expect(position.y).toBeCloseTo(2)
		expect(position.z).toBeCloseTo(3)
		expect(quaternion.w).toBeCloseTo(1)
		// Diameter (2r) radially, full length (l) axially.
		expect(scale.x).toBeCloseTo(0.1)
		expect(scale.y).toBeCloseTo(0.1)
		expect(scale.z).toBeCloseTo(0.2)
	})

	it('clamps the axial extent to 2r when l ≤ 2r (sphere bounds)', () => {
		// l = 150 mm < 2r = 200 mm: the capsule renders as a sphere of radius r,
		// so the bounds are 2r on every axis.
		const entity = world.spawn(traits.Capsule({ r: 100, l: 150 }), traits.WorldMatrix())

		composeCapsuleBoundsMatrix(entity, bounds)

		const { scale } = decompose(bounds)
		expect(scale.x).toBeCloseTo(0.2)
		expect(scale.y).toBeCloseTo(0.2)
		expect(scale.z).toBeCloseTo(0.2)
	})

	it('applies Center between WorldMatrix and the bounds scale', () => {
		const entity = world.spawn(
			traits.Capsule({ r: 50, l: 200 }),
			traits.WorldMatrix(new Pose(0, 0, 0, 0, 0, 1, 90).toMatrix4()),
			traits.Center(new Pose(500, 0, 0))
		)

		composeCapsuleBoundsMatrix(entity, bounds)

		const { position, scale } = decompose(bounds)
		expect(position.x).toBeCloseTo(0)
		expect(position.y).toBeCloseTo(0.5)
		expect(position.z).toBeCloseTo(0)
		expect(scale.x).toBeCloseTo(0.1)
		expect(scale.z).toBeCloseTo(0.2)
	})

	it.each([
		['Capsule', () => world.spawn(traits.WorldMatrix(new Pose(1000, 0, 0).toMatrix4()))],
		['WorldMatrix', () => world.spawn(traits.Capsule({ r: 50, l: 200 }))],
	])('returns false and leaves out untouched when %s is missing', (_missing, spawn) => {
		const entity = spawn()
		const sentinel = new Pose(9000, 9000, 9000).toMatrix4()
		bounds.copy(sentinel)

		expect(composeCapsuleBoundsMatrix(entity, bounds)).toBe(false)
		expect(bounds.equals(sentinel)).toBe(true)
	})
})
