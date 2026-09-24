import { createWorld, type World } from 'koota'
import { Matrix4, Quaternion, Vector3 } from 'three'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { traits } from '$lib/ecs'
import { Pose } from '$lib/math'

import { composeBoxMatrix } from '../composeBoxMatrix'

const decompose = (matrix: Matrix4) => {
	const position = new Vector3()
	const quaternion = new Quaternion()
	const scale = new Vector3()
	matrix.decompose(position, quaternion, scale)
	return { position, quaternion, scale }
}

describe('composeBoxMatrix', () => {
	let world: World
	beforeEach(() => {
		world = createWorld()
	})
	afterEach(() => {
		world.destroy()
	})

	it('composes WorldMatrix × box dimensions (mm → m) when no Center is present', () => {
		const entity = world.spawn(
			traits.Box({ x: 200, y: 400, z: 600 }),
			traits.WorldMatrix(new Pose(1000, 2000, 3000).toMatrix4())
		)
		const out = new Matrix4()

		expect(composeBoxMatrix(entity, out)).toBe(true)

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
		// … and the box dimensions folded in as scale, in metres.
		expect(scale.x).toBeCloseTo(0.2)
		expect(scale.y).toBeCloseTo(0.4)
		expect(scale.z).toBeCloseTo(0.6)
	})

	it('applies Center between WorldMatrix and the dimension scale', () => {
		// WorldMatrix rotates 90° about Z. Because the composition is
		// WorldMatrix × Center (not the reverse), the Center's +0.5 m local-x
		// offset is rotated by it and lands on world +y.
		const entity = world.spawn(
			traits.Box({ x: 200, y: 200, z: 200 }),
			traits.WorldMatrix(new Pose(0, 0, 0, 0, 0, 1, 90).toMatrix4()),
			traits.Center(new Pose(500, 0, 0))
		)
		const out = new Matrix4()

		expect(composeBoxMatrix(entity, out)).toBe(true)

		const { position, quaternion, scale } = decompose(out)
		expect(position.x).toBeCloseTo(0)
		expect(position.y).toBeCloseTo(0.5)
		expect(position.z).toBeCloseTo(0)
		// The WorldMatrix rotation is preserved (90° about Z) …
		expect(quaternion.z).toBeCloseTo(Math.SQRT1_2)
		expect(quaternion.w).toBeCloseTo(Math.SQRT1_2)
		// … and the scale is folded in last, so it does not shift the Center
		// offset baked into the translation above.
		expect(scale.x).toBeCloseTo(0.2)
		expect(scale.y).toBeCloseTo(0.2)
		expect(scale.z).toBeCloseTo(0.2)
	})

	it.each([
		['Box', () => world.spawn(traits.WorldMatrix(new Pose(1000, 0, 0).toMatrix4()))],
		['WorldMatrix', () => world.spawn(traits.Box({ x: 200, y: 200, z: 200 }))],
	])('returns false and leaves out untouched when %s is missing', (_missing, spawn) => {
		const entity = spawn()
		const sentinel = new Pose(9000, 9000, 9000).toMatrix4()
		const out = sentinel.clone()

		expect(composeBoxMatrix(entity, out)).toBe(false)
		expect(out.equals(sentinel)).toBe(true)
	})
})
