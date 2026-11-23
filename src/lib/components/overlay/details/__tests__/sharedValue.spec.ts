import { describe, expect, it } from 'vitest'

import { changedAxes, formatInputNumber, MIXED, sharedNumber } from '../sharedValue'

describe('sharedNumber', () => {
	it('reads numbers apart only by matrix decomposition noise as one value', () => {
		expect(sharedNumber([100, 100.000_000_001])).toBe(100)
	})

	it('reports numbers that differ as mixed', () => {
		expect(sharedNumber([100, 200])).toBe(MIXED)
	})
})

describe('changedAxes', () => {
	it('keeps only the axis the user edited, so the others stay each entity’s own', () => {
		expect(changedAxes({ x: Number.NaN, y: 50, z: 0 }, { x: Number.NaN, y: 60, z: 0 })).toEqual({
			y: 60,
		})
	})

	it('reports a value typed into a mixed axis', () => {
		expect(changedAxes({ x: Number.NaN, y: 50 }, { x: 5, y: 50 })).toEqual({ x: 5 })
	})
})

describe('formatInputNumber', () => {
	it.each([
		{ value: Number.NaN, expected: '-' },
		{ value: 1.5, expected: '1.50' },
		{ value: 123.456_789, expected: '123.456789' },
	])('formats $value as $expected', ({ value, expected }) => {
		expect(formatInputNumber(value)).toBe(expected)
	})
})
