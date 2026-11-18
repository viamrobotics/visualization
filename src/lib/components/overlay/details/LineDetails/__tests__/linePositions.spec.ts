import { describe, expect, it } from 'vitest'

import { appendLinePosition, removeLinePosition, writeLinePosition } from '../linePositions'

describe('writeLinePosition', () => {
	it('overwrites the point at the given index', () => {
		const source = new Float32Array([1, 2, 3, 4, 5, 6, 7, 8, 9])
		const next = writeLinePosition(source, 1, 40, 50, 60)
		expect([...next]).toEqual([1, 2, 3, 40, 50, 60, 7, 8, 9])
	})

	it('returns a fresh Float32Array (does not mutate input)', () => {
		const source = new Float32Array([1, 2, 3])
		const next = writeLinePosition(source, 0, 10, 20, 30)
		expect(next).not.toBe(source)
		expect([...source]).toEqual([1, 2, 3])
	})

	it('returns a copy unchanged when index is out of bounds', () => {
		const source = new Float32Array([1, 2, 3])
		const next = writeLinePosition(source, 5, 99, 99, 99)
		expect(next).not.toBe(source)
		expect([...next]).toEqual([1, 2, 3])
	})
})

describe('appendLinePosition', () => {
	it('appends a zero-valued point when the source is empty', () => {
		const next = appendLinePosition(new Float32Array())
		expect([...next]).toEqual([0, 0, 0])
	})

	it('appends a point offset by +0.1 in X from the previous tail', () => {
		const source = new Float32Array([0, 0, 0, 1, 2, 3])
		const next = appendLinePosition(source)
		expect(next.length).toBe(9)
		expect(next[6]).toBeCloseTo(1.1)
		expect(next[7]).toBe(2)
		expect(next[8]).toBe(3)
	})

	it('preserves prior points', () => {
		const source = new Float32Array([1, 2, 3])
		const next = appendLinePosition(source)
		expect([...next.subarray(0, 3)]).toEqual([1, 2, 3])
	})
})

describe('removeLinePosition', () => {
	it('refuses to remove when there are only two points', () => {
		const source = new Float32Array([0, 0, 0, 1, 1, 1])
		const next = removeLinePosition(source, 0)
		expect(next).toBe(source)
	})

	it('removes the first point', () => {
		const source = new Float32Array([1, 2, 3, 4, 5, 6, 7, 8, 9])
		const next = removeLinePosition(source, 0)
		expect([...next]).toEqual([4, 5, 6, 7, 8, 9])
	})

	it('removes a middle point', () => {
		const source = new Float32Array([1, 2, 3, 4, 5, 6, 7, 8, 9])
		const next = removeLinePosition(source, 1)
		expect([...next]).toEqual([1, 2, 3, 7, 8, 9])
	})

	it('removes the last point', () => {
		const source = new Float32Array([1, 2, 3, 4, 5, 6, 7, 8, 9])
		const next = removeLinePosition(source, 2)
		expect([...next]).toEqual([1, 2, 3, 4, 5, 6])
	})

	it('keeps original array intact', () => {
		const source = new Float32Array([1, 2, 3, 4, 5, 6, 7, 8, 9])
		removeLinePosition(source, 1)
		expect([...source]).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9])
	})

	it('returns source unchanged when index is out of bounds', () => {
		const source = new Float32Array([1, 2, 3, 4, 5, 6, 7, 8, 9])
		const next = removeLinePosition(source, 5)
		expect(next).toBe(source)
	})
})
