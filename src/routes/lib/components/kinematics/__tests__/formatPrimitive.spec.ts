import { describe, expect, it } from 'vitest'

import {
	Primitive,
	Primitive_Box,
	Primitive_Capsule,
	Primitive_Cylinder,
	Primitive_Sphere,
} from '$lib/buf/kinematics/v1/spec_pb'

import { formatPrimitive } from '../formatPrimitive'

describe('formatPrimitive', () => {
	it('formats each shape rounded to one decimal', () => {
		const box = new Primitive({
			shape: { case: 'box', value: new Primitive_Box({ x: 100, y: 50.26, z: 20 }) },
		})
		const sphere = new Primitive({
			shape: { case: 'sphere', value: new Primitive_Sphere({ radius: 7.04 }) },
		})
		const capsule = new Primitive({
			shape: { case: 'capsule', value: new Primitive_Capsule({ radius: 3, length: 9 }) },
		})
		const cylinder = new Primitive({
			shape: { case: 'cylinder', value: new Primitive_Cylinder({ radius: 10, length: 40 }) },
		})
		expect(formatPrimitive(box)).toBe('Box 100 × 50.3 × 20 mm')
		expect(formatPrimitive(sphere)).toBe('Sphere r 7 mm')
		expect(formatPrimitive(capsule)).toBe('Capsule r 3, length 9 mm')
		expect(formatPrimitive(cylinder)).toBe('Cylinder r 10, length 40 mm')
	})

	it('returns undefined when no shape is set', () => {
		expect(formatPrimitive(new Primitive())).toBeUndefined()
		expect(formatPrimitive(undefined)).toBeUndefined()
	})
})
