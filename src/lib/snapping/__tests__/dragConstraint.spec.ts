import { Quaternion, Vector3 } from 'three'
import { describe, expect, it } from 'vitest'

import { constrainDelta, dragConstraintFor } from '../dragConstraint'

const quarterTurnZ = new Quaternion().setFromAxisAngle(new Vector3(0, 0, 1), Math.PI / 2)

describe('dragConstraintFor', () => {
	it('treats the centre handle as free', () => {
		expect(dragConstraintFor('XYZ', 'local', quarterTurnZ)).toEqual({ kind: 'free' })
	})

	it('reads a single letter as an axis in world space', () => {
		expect(dragConstraintFor('X', 'world', quarterTurnZ)).toEqual({
			kind: 'axis',
			direction: new Vector3(1, 0, 0),
		})
	})

	it('turns a local axis with the gizmo', () => {
		const constraint = dragConstraintFor('X', 'local', quarterTurnZ)

		expect(
			constraint.kind === 'axis' && constraint.direction.distanceTo(new Vector3(0, 1, 0))
		).toBeCloseTo(0)
	})

	it('reads two letters as the plane normal to the missing one', () => {
		expect(dragConstraintFor('XY', 'world', new Quaternion())).toEqual({
			kind: 'plane',
			normal: new Vector3(0, 0, 1),
		})
	})
})

describe('constrainDelta', () => {
	it('keeps only the part along an axis', () => {
		const delta = constrainDelta(new Vector3(1, 2, 3), {
			kind: 'axis',
			direction: new Vector3(0, 1, 0),
		})

		expect(delta).toEqual(new Vector3(0, 2, 0))
	})

	it('drops the part across a plane', () => {
		const delta = constrainDelta(new Vector3(1, 2, 3), {
			kind: 'plane',
			normal: new Vector3(0, 0, 1),
		})

		expect(delta).toEqual(new Vector3(1, 2, 0))
	})
})
