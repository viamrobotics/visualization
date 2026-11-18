import type { InterleavedBufferAttribute } from 'three'

import { Matrix4 } from 'three'
import { describe, expect, it } from 'vitest'

import { BatchedAxesHelpers } from '../BatchedAxesHelper'

describe('BatchedAxesHelpers', () => {
	const SEGMENTS_PER_AXES = 3
	const FLOATS_PER_SEGMENT = 6
	const FLOATS_PER_AXES = 18
	const AXIS_LENGTH = 0.5

	type Point = [number, number, number]
	type Axes = { start: Point; end: Point }[]

	const translation = (x: number) => new Matrix4().makeTranslation(x, 0, 0)

	const axesAt = (x: number): Axes => [
		{ start: [x, 0, 0], end: [x + AXIS_LENGTH, 0, 0] },
		{ start: [x, 0, 0], end: [x, AXIS_LENGTH, 0] },
		{ start: [x, 0, 0], end: [x, 0, AXIS_LENGTH] },
	]

	const drawnAxesByOrigin = (helpers: BatchedAxesHelpers): Axes[] => {
		const attribute = helpers.geometry.attributes.instanceStart as InterleavedBufferAttribute
		const floats = attribute.data.array
		const count = helpers.geometry.instanceCount / SEGMENTS_PER_AXES

		const point = (offset: number): Point => [
			floats[offset],
			floats[offset + 1],
			floats[offset + 2],
		]

		return Array.from({ length: count }, (_, slot) =>
			[0, 1, 2].map((segment) => {
				const offset = slot * FLOATS_PER_AXES + segment * FLOATS_PER_SEGMENT
				return { start: point(offset), end: point(offset + 3) }
			})
		).toSorted((a, b) => a[0].start[0] - b[0].start[0])
	}

	it('spans the axis length for a visible helper', () => {
		const helpers = new BatchedAxesHelpers({ axisLength: AXIS_LENGTH })
		helpers.addHelper(new Matrix4())

		expect(drawnAxesByOrigin(helpers)).toEqual([axesAt(0)])
	})

	it('stops drawing a hidden helper without disturbing the others', () => {
		const helpers = new BatchedAxesHelpers({ axisLength: AXIS_LENGTH })
		helpers.addHelper(translation(1))
		const hidden = helpers.addHelper(translation(2))
		helpers.addHelper(translation(3))

		helpers.setVisibleAt(hidden, false)

		expect(helpers.geometry.instanceCount).toBe(2 * SEGMENTS_PER_AXES)
		expect(drawnAxesByOrigin(helpers)).toEqual([axesAt(1), axesAt(3)])
	})

	it('moves a helper by its handle after another helper is removed', () => {
		const helpers = new BatchedAxesHelpers({ axisLength: AXIS_LENGTH })
		helpers.addHelper(translation(1))
		const removed = helpers.addHelper(translation(2))
		const moved = helpers.addHelper(translation(3))

		helpers.removeHelper(removed)
		helpers.setMatrixAt(moved, translation(9))

		expect(drawnAxesByOrigin(helpers)).toEqual([axesAt(1), axesAt(9)])
	})

	it('restores a hidden helper when shown, including matrix changes made while hidden', () => {
		const helpers = new BatchedAxesHelpers({ axisLength: AXIS_LENGTH })
		const toggled = helpers.addHelper(translation(1))
		helpers.addHelper(translation(2))

		helpers.setVisibleAt(toggled, false)
		helpers.setMatrixAt(toggled, translation(5))
		helpers.setVisibleAt(toggled, true)

		expect(drawnAxesByOrigin(helpers)).toEqual([axesAt(2), axesAt(5)])
	})

	it('keeps existing helpers when adding past capacity', () => {
		const helpers = new BatchedAxesHelpers({ axisLength: AXIS_LENGTH, capacity: 2 })
		helpers.addHelper(translation(1))
		helpers.addHelper(translation(2))
		helpers.addHelper(translation(3))

		expect(drawnAxesByOrigin(helpers)).toEqual([axesAt(1), axesAt(2), axesAt(3)])
	})
})
