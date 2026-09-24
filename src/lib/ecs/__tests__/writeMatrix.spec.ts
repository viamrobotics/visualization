import { createWorld } from 'koota'
import { describe, expect, it, vi } from 'vitest'

import { traits } from '$lib/ecs'
import { Pose } from '$lib/math'

import { writeMatrix } from '../traits'

const matrix = () => new Pose(10, 20, 30, 0.6, 0.8, 0, 45).toMatrix4()

describe('writeMatrix', () => {
	it('no-ops when the entity has no Matrix trait', () => {
		const world = createWorld()
		const entity = world.spawn()
		expect(() => writeMatrix(entity, { x: 1 })).not.toThrow()
	})

	it('overwrites only the supplied position fields', () => {
		const world = createWorld()
		const entity = world.spawn(traits.Matrix(matrix()))
		writeMatrix(entity, { x: 99 })
		const pose = new Pose().setFromMatrix4(entity.get(traits.Matrix)!)
		expect(pose.x).toBeCloseTo(99)
		expect(pose.y).toBeCloseTo(20)
		expect(pose.z).toBeCloseTo(30)
	})

	it('overwrites only the supplied orientation fields', () => {
		const world = createWorld()
		const entity = world.spawn(traits.Matrix(matrix()))
		writeMatrix(entity, { theta: 90 })
		const pose = new Pose().setFromMatrix4(entity.get(traits.Matrix)!)
		expect(pose.x).toBeCloseTo(10)
		expect(pose.theta).toBeCloseTo(90)
		expect(pose.oX).toBeCloseTo(0.6)
		expect(pose.oY).toBeCloseTo(0.8)
		expect(pose.oZ).toBeCloseTo(0)
	})

	it('notifies subscribers via entity.changed', () => {
		const world = createWorld()
		const entity = world.spawn(traits.Matrix(matrix()))
		const onChange = vi.fn()
		world.onChange(traits.Matrix, onChange)
		writeMatrix(entity, { x: 5 })
		expect(onChange).toHaveBeenCalledWith(entity)
	})

	it('mutates the existing Matrix4 in place (does not allocate a new one)', () => {
		const world = createWorld()
		const entity = world.spawn(traits.Matrix(matrix()))
		const before = entity.get(traits.Matrix)
		writeMatrix(entity, { x: 5 })
		const after = entity.get(traits.Matrix)
		expect(after).toBe(before)
	})

	it('ignores explicitly undefined fields', () => {
		const world = createWorld()
		const entity = world.spawn(traits.Matrix(matrix()))
		writeMatrix(entity, { x: undefined })
		const pose = new Pose().setFromMatrix4(entity.get(traits.Matrix)!)
		expect(pose.x).toBeCloseTo(10)
		expect(pose.y).toBeCloseTo(20)
		expect(pose.z).toBeCloseTo(30)
	})

	it('does not notify subscribers when patch is empty', () => {
		const world = createWorld()
		const entity = world.spawn(traits.Matrix(matrix()))
		const onChange = vi.fn()
		world.onChange(traits.Matrix, onChange)
		writeMatrix(entity, {})
		expect(onChange).not.toHaveBeenCalled()
	})

	it('does not notify subscribers when all patch fields are undefined', () => {
		const world = createWorld()
		const entity = world.spawn(traits.Matrix(matrix()))
		const onChange = vi.fn()
		world.onChange(traits.Matrix, onChange)
		writeMatrix(entity, { x: undefined, y: undefined })
		expect(onChange).not.toHaveBeenCalled()
	})
})
