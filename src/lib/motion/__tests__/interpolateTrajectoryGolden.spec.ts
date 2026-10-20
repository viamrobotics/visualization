import { describe, expect, it } from 'vitest'

import goldenFile from '../../../../tools/rdk-golden/motion/testdata/interpolate_inputs_golden.json'
import { lerpTrajectoryStep } from '../interpolateTrajectory'

const cases = goldenFile.cases as {
	name: string
	from: number[]
	to: number[]
	by: number
	interpolated: number[]
}[]

/**
 * Both sides compute `from + (to - from) * by`, but Go may fuse that multiply-add on arm64, so
 * the last bit can differ and exact equality would fail on some machines only.
 */
const PLACES = 12

describe('lerpTrajectoryStep, against the inputs SimpleModel.Interpolate blends to', () => {
	it('reads all 8 cases the Go generator wrote', () => {
		expect(cases.length).toBe(8)
	})

	it.each(cases)('blends $name the way RDK does', ({ from, to, by, interpolated }) => {
		const blended = lerpTrajectoryStep({ arm: from }, { arm: to }, by).arm!

		expect(blended).toHaveLength(interpolated.length)
		for (const [index, value] of interpolated.entries()) {
			expect(blended[index]).toBeCloseTo(value, PLACES)
		}
	})
})
