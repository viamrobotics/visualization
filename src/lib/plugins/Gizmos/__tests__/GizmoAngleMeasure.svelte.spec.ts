import { describe, expect, it } from 'vitest'

import type { Point3 } from '../angle'

import { angleLabel, angleLabelName } from '../GizmoAngleMeasure.svelte'

describe('angleLabel', () => {
	// A ~63.43-degree angle (arctan(2)), so a wrong formula prints a different number than
	// a round value like 60 or 90 would let slip through.
	const a: Point3 = [1, 0, 0]
	const vertex: Point3 = [0, 0, 0]
	const b: Point3 = [1, 2, 0]

	it('positions the label at the middle vertex', () => {
		expect(angleLabel([a, vertex, b])?.position).toEqual(vertex)
	})

	it('reads the interior angle in degrees to two decimals', () => {
		expect(angleLabel([a, vertex, b])?.degrees).toBeCloseTo(63.43, 2)
	})

	it('produces no label for fewer than three points', () => {
		expect(angleLabel([a, vertex])).toBeUndefined()
	})

	it('produces no label when the vertex coincides with an endpoint', () => {
		expect(angleLabel([vertex, vertex, b])).toBeUndefined()
	})
})

describe('angleLabelName', () => {
	it('names the label with the degree value and unit', () => {
		expect(angleLabelName(63.4349488)).toBe('Angle: 63.43 degrees')
	})
})
