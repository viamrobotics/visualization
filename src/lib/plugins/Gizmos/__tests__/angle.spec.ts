import { describe, expect, it } from 'vitest'

import { interiorAngle, type Point3 } from '../angle'

const origin: Point3 = [0, 0, 0]

describe('interiorAngle', () => {
	it('measures a right angle', () => {
		expect(interiorAngle([1, 0, 0], origin, [0, 1, 0])).toBeCloseTo(90)
	})

	it('measures an acute angle', () => {
		expect(interiorAngle([1, 0, 0], origin, [1, 1, 0])).toBeCloseTo(45)
	})

	it('measures an obtuse angle', () => {
		expect(interiorAngle([1, 0, 0], origin, [-1, 1, 0])).toBeCloseTo(135)
	})

	it('returns 0 for rays that are collinear and point the same way', () => {
		expect(interiorAngle([1, 0, 0], origin, [2, 0, 0])).toBeCloseTo(0)
	})

	it('returns 180 for rays that are collinear and point opposite ways', () => {
		expect(interiorAngle([1, 0, 0], origin, [-1, 0, 0])).toBeCloseTo(180)
	})

	it('returns 0, not NaN, when a ray has zero length', () => {
		// `a` coincides with `vertex`, so the ray to `a` has no direction.
		expect(interiorAngle(origin, origin, [1, 0, 0])).toBe(0)
	})

	it('returns 0, not NaN, when both rays have zero length', () => {
		expect(interiorAngle(origin, origin, origin)).toBe(0)
	})
})
