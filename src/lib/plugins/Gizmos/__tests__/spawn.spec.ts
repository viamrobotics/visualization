import { createWorld } from 'koota'
import { Matrix4, Vector3 } from 'three'
import { describe, expect, it } from 'vitest'

import { traits } from '$lib/ecs'

import { cancelPending, confirmPending, spawnGizmo, spawnPending } from '../spawn'
import { PendingGizmo } from '../traits'

const { Gizmo } = traits

describe('spawnGizmo', () => {
	it('attaches the shared trait set', () => {
		const world = createWorld()
		const entity = spawnGizmo(world, { kind: 'arrow', traits: [] })
		expect(entity.has(traits.Name)).toBe(true)
		expect(entity.has(traits.Matrix)).toBe(true)
		expect(entity.has(traits.Removable)).toBe(true)
		expect(entity.has(traits.Editable)).toBe(true)
		expect(entity.has(traits.CustomDetails)).toBe(true)
		expect(entity.has(Gizmo)).toBe(true)
	})

	it('numbers the first gizmo of a kind starting at 1', () => {
		const world = createWorld()
		const entity = spawnGizmo(world, { kind: 'arrow', traits: [] })
		expect(entity.get(traits.Name)).toBe('arrow 1')
	})

	it('skips already-used indices', () => {
		const world = createWorld()
		spawnGizmo(world, { kind: 'plane', traits: [] })
		spawnGizmo(world, { kind: 'plane', traits: [] })
		const third = spawnGizmo(world, { kind: 'plane', traits: [] })
		expect(third.get(traits.Name)).toBe('plane 3')
	})

	it('fills the lowest free slot left by a removed gizmo, not the next counter value', () => {
		const world = createWorld()
		const first = spawnGizmo(world, { kind: 'plane', traits: [] })
		const second = spawnGizmo(world, { kind: 'plane', traits: [] })
		spawnGizmo(world, { kind: 'plane', traits: [] })
		second.destroy()

		const fourth = spawnGizmo(world, { kind: 'plane', traits: [] })
		expect(fourth.get(traits.Name)).toBe('plane 2')
		expect(first.get(traits.Name)).toBe('plane 1')
	})

	it('numbers different kinds independently', () => {
		const world = createWorld()
		spawnGizmo(world, { kind: 'arrow', traits: [] })
		const plane = spawnGizmo(world, { kind: 'plane', traits: [] })
		expect(plane.get(traits.Name)).toBe('plane 1')
	})

	it('ignores entities with non-numeric or unrelated name suffixes', () => {
		const world = createWorld()
		world.spawn(traits.Name('arrow foo'))
		world.spawn(traits.Name('arrowhead 1'))
		const arrow = spawnGizmo(world, { kind: 'arrow', traits: [] })
		expect(arrow.get(traits.Name)).toBe('arrow 1')
	})
})

describe('spawnPending', () => {
	it('attaches PendingGizmo on top of the shared trait set', () => {
		const world = createWorld()
		const entity = spawnPending(world, {
			kind: 'arrow',
			position: new Vector3(),
			traits: [],
		})
		expect(entity.has(PendingGizmo)).toBe(true)
		expect(entity.has(Gizmo)).toBe(true)
		expect(entity.has(traits.Editable)).toBe(true)
	})

	it('composes a Matrix from a given position', () => {
		const world = createWorld()
		const entity = spawnPending(world, {
			kind: 'arrow',
			position: new Vector3(10, 20, 30),
			traits: [],
		})
		const translation = new Vector3().setFromMatrixPosition(entity.get(traits.Matrix)!)
		expect(translation.x).toBeCloseTo(10)
		expect(translation.y).toBeCloseTo(20)
		expect(translation.z).toBeCloseTo(30)
	})

	it('uses an explicit matrix over the position when given', () => {
		const world = createWorld()
		const explicit = new Matrix4().setPosition(1, 2, 3)
		const entity = spawnPending(world, {
			kind: 'arrow',
			position: new Vector3(10, 20, 30),
			matrix: explicit,
			traits: [],
		})
		const translation = new Vector3().setFromMatrixPosition(entity.get(traits.Matrix)!)
		expect(translation.x).toBeCloseTo(1)
		expect(translation.y).toBeCloseTo(2)
		expect(translation.z).toBeCloseTo(3)
	})

	it('confirmPending drops the PendingGizmo tag', () => {
		const world = createWorld()
		const entity = spawnPending(world, {
			kind: 'arrow',
			position: new Vector3(),
			traits: [],
		})
		confirmPending(entity)
		expect(entity.has(PendingGizmo)).toBe(false)
		expect(entity.isAlive()).toBe(true)
	})

	it('cancelPending destroys a still-pending entity', () => {
		const world = createWorld()
		const entity = spawnPending(world, {
			kind: 'arrow',
			position: new Vector3(),
			traits: [],
		})
		cancelPending(entity)
		expect(entity.isAlive()).toBe(false)
	})

	it('cancelPending is a no-op after confirm', () => {
		const world = createWorld()
		const entity = spawnPending(world, {
			kind: 'arrow',
			position: new Vector3(),
			traits: [],
		})
		confirmPending(entity)
		cancelPending(entity)
		expect(entity.isAlive()).toBe(true)
	})

	it('cancelPending is a no-op on an already-destroyed entity', () => {
		const world = createWorld()
		const entity = spawnPending(world, {
			kind: 'arrow',
			position: new Vector3(),
			traits: [],
		})
		cancelPending(entity)
		expect(() => cancelPending(entity)).not.toThrow()
		expect(entity.isAlive()).toBe(false)
	})

	it('cancelPending tolerates undefined', () => {
		expect(() => cancelPending(undefined)).not.toThrow()
	})
})
