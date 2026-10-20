import { describe, expect, it } from 'vitest'

import { LengthUnit } from '$lib/buf/kinematics/v1/spec_pb'

import { unitHint } from '../unitHint'

describe('unitHint', () => {
	it('suggests millimetres for a huge extent read as metres', () => {
		expect(unitHint({ x: 300000, y: 1, z: 1 }, LengthUnit.METERS)).toBe(LengthUnit.MILLIMETERS)
	})

	it('suggests metres for a tiny extent read as millimetres', () => {
		expect(unitHint({ x: 0.3, y: 0.1, z: 0.1 }, LengthUnit.MILLIMETERS)).toBe(LengthUnit.METERS)
	})

	it('stays quiet for a plausible extent', () => {
		expect(unitHint({ x: 300, y: 10, z: 10 }, LengthUnit.MILLIMETERS)).toBeUndefined()
		expect(unitHint(undefined, LengthUnit.METERS)).toBeUndefined()
	})
})
