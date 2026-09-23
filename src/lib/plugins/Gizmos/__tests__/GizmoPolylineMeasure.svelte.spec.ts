import { describe, expect, it } from 'vitest'

import {
	type Point3,
	polylineLabelName,
	polylineLabels,
	toPoints,
} from '../GizmoPolylineMeasure.svelte'

describe('toPoints', () => {
	it('unpacks a flat LinePositions triple array into points', () => {
		const positions = new Float32Array([0, 0, 0, 1, 2, 3])

		expect(toPoints(positions)).toEqual([
			[0, 0, 0],
			[1, 2, 3],
		])
	})
})

describe('polylineLabels', () => {
	// A 3-4-5 triangle leg in metres, so the label is a round mm value: 0.005m -> "5.00".
	const a: Point3 = [0, 0, 0]
	const b: Point3 = [0.003, 0.004, 0]

	it('labels each segment at its midpoint, in millimetres', () => {
		const labels = polylineLabels([a, b], 'segment')

		expect(labels).toHaveLength(1)
		// Not "0.01" or "5" — the mm conversion and the two-decimal format both matter here.
		expect(labels[0]?.text).toBe('5.00')
		expect(labels[0]?.position).toEqual([0.0015, 0.002, 0])
	})

	it('labels a running total at the last vertex, in millimetres', () => {
		const c: Point3 = [0.003, 0.008, 0]
		const labels = polylineLabels([a, b, c], 'total')

		expect(labels).toHaveLength(1)
		expect(labels[0]?.text).toBe('9.00')
		expect(labels[0]?.position).toEqual(c)
	})

	it('skips a zero-length segment rather than labeling it', () => {
		const labels = polylineLabels([a, a, b], 'segment')

		expect(labels).toHaveLength(1)
		expect(labels[0]?.text).toBe('5.00')
	})

	it('produces no labels when the total distance is zero', () => {
		expect(polylineLabels([a, a], 'total')).toEqual([])
	})

	it('produces no labels for fewer than two points', () => {
		expect(polylineLabels([a], 'segment')).toEqual([])
		expect(polylineLabels([], 'total')).toEqual([])
	})
})

describe('polylineLabelName', () => {
	it('names a segment label by its position in the polyline and its length', () => {
		expect(polylineLabelName('segment', 0, '5.00')).toBe('Segment 1: 5.00 millimeters')
		expect(polylineLabelName('segment', 2, '9.00')).toBe('Segment 3: 9.00 millimeters')
	})

	it('names a total label as the running total, not a segment', () => {
		expect(polylineLabelName('total', 0, '9.00')).toBe('Total distance: 9.00 millimeters')
	})
})
