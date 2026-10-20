import { createWorld, type World } from 'koota'
import { Matrix4, Quaternion, Vector3 } from 'three'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { traits } from '$lib/ecs'
import { Pose } from '$lib/math'

import { composeCylinderBoundsMatrix, composeCylinderMatrix } from '../composeCylinderMatrix'

const decompose = (matrix: Matrix4) => {
	const position = new Vector3()
	const quaternion = new Quaternion()
	const scale = new Vector3()
	matrix.decompose(position, quaternion, scale)
	return { position, quaternion, scale }
}

/**
 * The shared unit cylinder is radius 1 and height 1 about Z, so its wall sits at
 * local radius 1 and its caps at local z = ±0.5. Every local point below is one
 * of those.
 */
const applyToLocalPoint = (matrix: Matrix4, x: number, y: number, z: number) =>
	new Vector3(x, y, z).applyMatrix4(matrix)

describe('composeCylinderMatrix', () => {
	let world: World
	let out: Matrix4

	beforeEach(() => {
		world = createWorld()
		out = new Matrix4()
	})
	afterEach(() => {
		world.destroy()
	})

	it('scales the unit cylinder to (r, r, l) in meters', () => {
		const entity = world.spawn(
			traits.Cylinder({ r: 50, l: 200, capped: true }),
			traits.WorldMatrix(new Pose(1000, 2000, 3000).toMatrix4())
		)

		expect(composeCylinderMatrix(entity, out)).toBe(true)

		const { position, scale } = decompose(out)
		expect(position.x).toBeCloseTo(1)
		expect(position.y).toBeCloseTo(2)
		expect(position.z).toBeCloseTo(3)
		expect(scale.x).toBeCloseTo(0.05)
		expect(scale.y).toBeCloseTo(0.05)
		expect(scale.z).toBeCloseTo(0.2)
	})

	it('centres the cylinder on the origin, spanning ±l/2 along z', () => {
		const entity = world.spawn(
			traits.Cylinder({ r: 50, l: 200, capped: true }),
			traits.WorldMatrix(new Pose(0, 0, 3000).toMatrix4())
		)

		composeCylinderMatrix(entity, out)

		expect(applyToLocalPoint(out, 0, 0, 0.5).z).toBeCloseTo(3.1)
		expect(applyToLocalPoint(out, 0, 0, -0.5).z).toBeCloseTo(2.9)
	})

	it('scales radially by r, not the diameter', () => {
		const entity = world.spawn(
			traits.Cylinder({ r: 50, l: 200, capped: true }),
			traits.WorldMatrix()
		)

		composeCylinderMatrix(entity, out)

		expect(applyToLocalPoint(out, 1, 0, 0).x).toBeCloseTo(0.05)
	})

	it('applies Center between WorldMatrix and the dimension scale', () => {
		const entity = world.spawn(
			traits.Cylinder({ r: 50, l: 200, capped: true }),
			traits.WorldMatrix(new Pose(0, 0, 0, 0, 0, 1, 90).toMatrix4()),
			traits.Center(new Pose(500, 0, 0))
		)

		composeCylinderMatrix(entity, out)

		const { position, scale } = decompose(out)
		expect(position.x).toBeCloseTo(0)
		expect(position.y).toBeCloseTo(0.5)
		expect(position.z).toBeCloseTo(0)
		expect(scale.z).toBeCloseTo(0.2)
	})

	it.each([
		['Cylinder', () => world.spawn(traits.WorldMatrix(new Pose(1000, 0, 0).toMatrix4()))],
		['WorldMatrix', () => world.spawn(traits.Cylinder({ r: 50, l: 200, capped: true }))],
	])('returns false and leaves out untouched when %s is missing', (_missing, spawn) => {
		const entity = spawn()
		const sentinel = new Pose(9000, 9000, 9000).toMatrix4()
		out.copy(sentinel)

		expect(composeCylinderMatrix(entity, out)).toBe(false)
		expect(out.equals(sentinel)).toBe(true)
	})
})

describe('composeCylinderBoundsMatrix', () => {
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
			traits.Cylinder({ r: 50, l: 200, capped: true }),
			traits.WorldMatrix(new Pose(1000, 2000, 3000).toMatrix4())
		)

		expect(composeCylinderBoundsMatrix(entity, bounds)).toBe(true)

		const { position, scale } = decompose(bounds)
		expect(position.x).toBeCloseTo(1)
		expect(position.y).toBeCloseTo(2)
		expect(position.z).toBeCloseTo(3)
		expect(scale.x).toBeCloseTo(0.1)
		expect(scale.y).toBeCloseTo(0.1)
		expect(scale.z).toBeCloseTo(0.2)
	})

	it('bounds an open cylinder the same as a solid one', () => {
		const entity = world.spawn(
			traits.Cylinder({ r: 50, l: 200, capped: false }),
			traits.WorldMatrix()
		)

		composeCylinderBoundsMatrix(entity, bounds)

		const { scale } = decompose(bounds)
		expect(scale.x).toBeCloseTo(0.1)
		expect(scale.y).toBeCloseTo(0.1)
		expect(scale.z).toBeCloseTo(0.2)
	})

	it('applies Center between WorldMatrix and the bounds scale', () => {
		const entity = world.spawn(
			traits.Cylinder({ r: 50, l: 200, capped: true }),
			traits.WorldMatrix(new Pose(0, 0, 0, 0, 0, 1, 90).toMatrix4()),
			traits.Center(new Pose(500, 0, 0))
		)

		composeCylinderBoundsMatrix(entity, bounds)

		const { position, scale } = decompose(bounds)
		expect(position.x).toBeCloseTo(0)
		expect(position.y).toBeCloseTo(0.5)
		expect(position.z).toBeCloseTo(0)
		expect(scale.x).toBeCloseTo(0.1)
		expect(scale.z).toBeCloseTo(0.2)
	})

	it.each([
		['Cylinder', () => world.spawn(traits.WorldMatrix(new Pose(1000, 0, 0).toMatrix4()))],
		['WorldMatrix', () => world.spawn(traits.Cylinder({ r: 50, l: 200, capped: true }))],
	])('returns false and leaves out untouched when %s is missing', (_missing, spawn) => {
		const entity = spawn()
		const sentinel = new Pose(9000, 9000, 9000).toMatrix4()
		bounds.copy(sentinel)

		expect(composeCylinderBoundsMatrix(entity, bounds)).toBe(false)
		expect(bounds.equals(sentinel)).toBe(true)
	})
})
