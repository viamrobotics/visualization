import { createWorld, type World } from 'koota'
import { Matrix4, Quaternion, Vector3 } from 'three'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { traits } from '$lib/ecs'
import { Pose } from '$lib/math'

import { composeSphereBoundsMatrix, composeSphereMatrix } from '../composeSphereMatrix'

const decompose = (matrix: Matrix4) => {
	const position = new Vector3()
	const quaternion = new Quaternion()
	const scale = new Vector3()
	matrix.decompose(position, quaternion, scale)
	return { position, quaternion, scale }
}

describe('composeSphereMatrix', () => {
	let world: World
	beforeEach(() => {
		world = createWorld()
	})
	afterEach(() => {
		world.destroy()
	})

	it('composes WorldMatrix × radius scale (mm → m) when no Center is present', () => {
		const entity = world.spawn(
			traits.Sphere({ r: 250 }),
			traits.WorldMatrix(new Pose(1000, 2000, 3000).toMatrix4())
		)
		const out = new Matrix4()

		expect(composeSphereMatrix(entity, out)).toBe(true)

		const { position, quaternion, scale } = decompose(out)
		// WorldMatrix translation (mm → m) carries through unchanged …
		expect(position.x).toBeCloseTo(1)
		expect(position.y).toBeCloseTo(2)
		expect(position.z).toBeCloseTo(3)
		// … with no rotation introduced …
		expect(quaternion.x).toBeCloseTo(0)
		expect(quaternion.y).toBeCloseTo(0)
		expect(quaternion.z).toBeCloseTo(0)
		expect(quaternion.w).toBeCloseTo(1)
		// … and the radius folded in as uniform scale, in metres (unit sphere is r = 1).
		expect(scale.x).toBeCloseTo(0.25)
		expect(scale.y).toBeCloseTo(0.25)
		expect(scale.z).toBeCloseTo(0.25)
	})

	it('applies Center between WorldMatrix and the radius scale', () => {
		// WorldMatrix rotates 90° about Z. Because the composition is
		// WorldMatrix × Center (not the reverse), the Center's +0.5 m local-x
		// offset is rotated by it and lands on world +y.
		const entity = world.spawn(
			traits.Sphere({ r: 100 }),
			traits.WorldMatrix(new Pose(0, 0, 0, 0, 0, 1, 90).toMatrix4()),
			traits.Center(new Pose(500))
		)
		const out = new Matrix4()

		expect(composeSphereMatrix(entity, out)).toBe(true)

		const { position, quaternion, scale } = decompose(out)
		expect(position.x).toBeCloseTo(0)
		expect(position.y).toBeCloseTo(0.5)
		expect(position.z).toBeCloseTo(0)
		// The WorldMatrix rotation is preserved (90° about Z) …
		expect(quaternion.z).toBeCloseTo(Math.SQRT1_2)
		expect(quaternion.w).toBeCloseTo(Math.SQRT1_2)
		// … and the scale is folded in last, so it does not shift the Center
		// offset baked into the translation above.
		expect(scale.x).toBeCloseTo(0.1)
		expect(scale.y).toBeCloseTo(0.1)
		expect(scale.z).toBeCloseTo(0.1)
	})

	it.each([
		['Sphere', () => world.spawn(traits.WorldMatrix(new Pose(1000, 0, 0).toMatrix4()))],
		['WorldMatrix', () => world.spawn(traits.Sphere({ r: 100 }))],
	])('returns false and leaves out untouched when %s is missing', (_missing, spawn) => {
		const entity = spawn()
		const sentinel = new Pose(9000, 9000, 9000).toMatrix4()
		const out = sentinel.clone()

		expect(composeSphereMatrix(entity, out)).toBe(false)
		expect(out.equals(sentinel)).toBe(true)
	})
})

describe('composeSphereBoundsMatrix', () => {
	let world: World
	let bounds: Matrix4
	beforeEach(() => {
		world = createWorld()
		bounds = new Matrix4()
	})
	afterEach(() => {
		world.destroy()
	})

	it('scales the selection bounds to the diameter (2r) on every axis', () => {
		const entity = world.spawn(
			traits.Sphere({ r: 250 }),
			traits.WorldMatrix(new Pose(1000, 2000, 3000).toMatrix4())
		)

		expect(composeSphereBoundsMatrix(entity, bounds)).toBe(true)

		const { position, quaternion, scale } = decompose(bounds)
		expect(position.x).toBeCloseTo(1)
		expect(position.y).toBeCloseTo(2)
		expect(position.z).toBeCloseTo(3)
		expect(quaternion.w).toBeCloseTo(1)
		// Diameter (2r) on every axis wraps the sphere in the unit OBB box.
		expect(scale.x).toBeCloseTo(0.5)
		expect(scale.y).toBeCloseTo(0.5)
		expect(scale.z).toBeCloseTo(0.5)
	})

	it('applies Center between WorldMatrix and the bounds scale', () => {
		const entity = world.spawn(
			traits.Sphere({ r: 100 }),
			traits.WorldMatrix(new Pose(0, 0, 0, 0, 0, 1, 90).toMatrix4()),
			traits.Center(new Pose(500, 0, 0))
		)

		composeSphereBoundsMatrix(entity, bounds)

		const { position, scale } = decompose(bounds)
		expect(position.x).toBeCloseTo(0)
		expect(position.y).toBeCloseTo(0.5)
		expect(position.z).toBeCloseTo(0)
		expect(scale.x).toBeCloseTo(0.2)
		expect(scale.y).toBeCloseTo(0.2)
		expect(scale.z).toBeCloseTo(0.2)
	})

	it.each([
		['Sphere', () => world.spawn(traits.WorldMatrix(new Pose(1000, 0, 0).toMatrix4()))],
		['WorldMatrix', () => world.spawn(traits.Sphere({ r: 100 }))],
	])('returns false and leaves out untouched when %s is missing', (_missing, spawn) => {
		const entity = spawn()
		const sentinel = new Pose(9000, 9000, 9000).toMatrix4()
		bounds.copy(sentinel)

		expect(composeSphereBoundsMatrix(entity, bounds)).toBe(false)
		expect(bounds.equals(sentinel)).toBe(true)
	})
})
