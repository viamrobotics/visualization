import type { InterleavedBufferAttribute } from 'three'

import { Matrix4 } from 'three'
import { describe, expect, it } from 'vitest'

import { BatchedAxesHelpers } from '../BatchedAxesHelper'

describe('BatchedAxesHelpers', () => {
	// Whether a zero-length segment draws its round cap is driver-dependent, so a
	// headless render cannot see the dot. The material's `maskNode` keys on the
	// collapse, and these pin that the class still produces it.
	const FLOATS_PER_SEGMENT = 6
	const FLOATS_PER_AXES = 18

	const segmentsOf = (helpers: BatchedAxesHelpers, index: number) => {
		const attribute = helpers.geometry.attributes.instanceStart as InterleavedBufferAttribute
		const floats = attribute.data.array
		const base = index * FLOATS_PER_AXES
		const point = (offset: number) => [
			floats[base + offset],
			floats[base + offset + 1],
			floats[base + offset + 2],
		]

		return [0, 1, 2].map((segment) => ({
			start: point(segment * FLOATS_PER_SEGMENT),
			end: point(segment * FLOATS_PER_SEGMENT + 3),
		}))
	}

	it('collapses a removed helper to a zero-length segment', () => {
		const helpers = new BatchedAxesHelpers()
		const index = helpers.addHelper(new Matrix4().makeTranslation(1, 2, 3))

		helpers.removeHelper(index)

		for (const { start, end } of segmentsOf(helpers, index)) {
			expect(start).toEqual(end)
		}
	})

	it('collapses a hidden helper to a zero-length segment', () => {
		const helpers = new BatchedAxesHelpers()
		const index = helpers.addHelper(new Matrix4().makeTranslation(1, 2, 3))

		helpers.setVisibleAt(index, false)

		for (const { start, end } of segmentsOf(helpers, index)) {
			expect(start).toEqual(end)
		}
	})

	it('spans the axis length for a visible helper', () => {
		const helpers = new BatchedAxesHelpers({ axisLength: 0.5 })
		const index = helpers.addHelper(new Matrix4())

		const [x, y, z] = segmentsOf(helpers, index)
		expect(x.end).toEqual([0.5, 0, 0])
		expect(y.end).toEqual([0, 0.5, 0])
		expect(z.end).toEqual([0, 0, 0.5])
	})
})
