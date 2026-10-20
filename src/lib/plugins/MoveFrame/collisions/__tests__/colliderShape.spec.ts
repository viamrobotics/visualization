import { createWorld } from 'koota'
import { Matrix4, Quaternion, Vector3 } from 'three'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { traits } from '$lib/ecs'

import { colliderShapeFor, composeColliderPose } from '../colliderShape'

let world: ReturnType<typeof createWorld>

beforeEach(() => {
	world = createWorld()
})

afterEach(() => {
	world.destroy()
})

describe('colliderShapeFor', () => {
	it('halves box dimensions and converts mm to metres', () => {
		const entity = world.spawn(traits.Box({ x: 200, y: 400, z: 600 }))

		expect(colliderShapeFor(entity)).toEqual({ kind: 'cuboid', hx: 0.1, hy: 0.2, hz: 0.3 })
	})

	it('converts sphere radius to metres', () => {
		const entity = world.spawn(traits.Sphere({ r: 250 }))

		expect(colliderShapeFor(entity)).toEqual({ kind: 'ball', radius: 0.25 })
	})

	it("subtracts both caps from Viam's total capsule length", () => {
		// l = 300mm total, r = 50mm → a 200mm cylinder, so halfHeight is 100mm.
		const entity = world.spawn(traits.Capsule({ l: 300, r: 50 }))

		expect(colliderShapeFor(entity)).toEqual({
			kind: 'capsule',
			halfHeight: expect.closeTo(0.1),
			radius: expect.closeTo(0.05),
		})
	})

	it('degenerates a capsule to a ball once the caps meet', () => {
		const entity = world.spawn(traits.Capsule({ l: 100, r: 50 }))

		expect(colliderShapeFor(entity)).toEqual({ kind: 'ball', radius: 0.05 })
	})

	it("halves the cylinder's full length, unlike a capsule's tip-to-tip length", () => {
		const entity = world.spawn(traits.Cylinder({ l: 300, r: 50, capped: true }))

		expect(colliderShapeFor(entity)).toEqual({
			kind: 'cylinder',
			halfHeight: expect.closeTo(0.15),
			radius: expect.closeTo(0.05),
		})
	})

	it('collides an open cylinder as a solid one', () => {
		const entity = world.spawn(traits.Cylinder({ l: 300, r: 50, capped: false }))

		expect(colliderShapeFor(entity)).toEqual({
			kind: 'cylinder',
			halfHeight: expect.closeTo(0.15),
			radius: expect.closeTo(0.05),
		})
	})

	it.each([
		['box with a zero extent', traits.Box({ x: 0, y: 100, z: 100 })],
		['sphere with no radius', traits.Sphere({ r: 0 })],
		['capsule with no radius', traits.Capsule({ l: 100, r: 0 })],
		['cylinder with no radius', traits.Cylinder({ l: 100, r: 0, capped: true })],
		['cylinder with no length', traits.Cylinder({ l: 0, r: 50, capped: true })],
	])('skips a %s', (_label, trait) => {
		expect(colliderShapeFor(world.spawn(trait))).toBeUndefined()
	})

	it('skips an entity with no collidable primitive', () => {
		expect(colliderShapeFor(world.spawn(traits.Name('frame')))).toBeUndefined()
	})
})

describe('composeColliderPose', () => {
	const position = new Vector3()
	const quaternion = new Quaternion()

	it('reads the world matrix', () => {
		const entity = world.spawn(
			traits.Box({ x: 100, y: 100, z: 100 }),
			traits.WorldMatrix(new Matrix4().makeTranslation(1, 2, 3))
		)

		composeColliderPose(entity, { kind: 'cuboid', hx: 1, hy: 1, hz: 1 }, position, quaternion)

		expect(position.toArray()).toEqual([1, 2, 3])
	})

	it("applies the geometry's centre offset on top of the world matrix", () => {
		const entity = world.spawn(
			traits.Box({ x: 100, y: 100, z: 100 }),
			traits.WorldMatrix(new Matrix4().makeTranslation(1, 0, 0)),
			// `Center` is a pose, so millimetres — the world matrix is metres.
			traits.Center({ x: 0, y: 2000, z: 0, oX: 0, oY: 0, oZ: 1, theta: 0 })
		)

		composeColliderPose(entity, { kind: 'cuboid', hx: 1, hy: 1, hz: 1 }, position, quaternion)

		expect(position.toArray()).toEqual([1, 2, 0])
	})

	it("rotates a capsule from Rapier's Y axis onto the scene's Z", () => {
		const entity = world.spawn(traits.Capsule({ l: 300, r: 50 }), traits.WorldMatrix(new Matrix4()))

		composeColliderPose(
			entity,
			{ kind: 'capsule', halfHeight: 0.1, radius: 0.05 },
			position,
			quaternion
		)

		const up = new Vector3(0, 1, 0).applyQuaternion(quaternion)
		expect(up.x).toBeCloseTo(0)
		expect(up.y).toBeCloseTo(0)
		expect(up.z).toBeCloseTo(1)
	})

	it("rotates a cylinder from Rapier's Y axis onto the scene's Z", () => {
		const entity = world.spawn(
			traits.Cylinder({ l: 300, r: 50, capped: true }),
			traits.WorldMatrix(new Matrix4())
		)

		composeColliderPose(
			entity,
			{ kind: 'cylinder', halfHeight: 0.15, radius: 0.05 },
			position,
			quaternion
		)

		const up = new Vector3(0, 1, 0).applyQuaternion(quaternion)
		expect(up.x).toBeCloseTo(0)
		expect(up.y).toBeCloseTo(0)
		expect(up.z).toBeCloseTo(1)
	})

	it('leaves a shape with no axis convention unrotated', () => {
		const entity = world.spawn(
			traits.Sphere({ r: 100 }),
			traits.WorldMatrix(new Matrix4().makeTranslation(0, 0, 1))
		)

		composeColliderPose(entity, { kind: 'ball', radius: 0.1 }, position, quaternion)

		expect(quaternion.equals(new Quaternion())).toBe(true)
	})

	it('reports failure when the entity has no world matrix', () => {
		const entity = world.spawn(traits.Box({ x: 100, y: 100, z: 100 }))

		expect(
			composeColliderPose(entity, { kind: 'cuboid', hx: 1, hy: 1, hz: 1 }, position, quaternion)
		).toBe(false)
	})
})
