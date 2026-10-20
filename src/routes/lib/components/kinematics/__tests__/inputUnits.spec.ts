import { describe, expect, it } from 'vitest'

import { JointType } from '$lib/buf/kinematics/v1/spec_pb'

import { fromDisplayUnits, toDisplayUnits, unitSuffix } from '../inputUnits'

describe('input units', () => {
	it('converts radians to degrees for a revolute joint', () => {
		expect(toDisplayUnits(JointType.REVOLUTE, Math.PI / 2)).toBeCloseTo(90)
		expect(fromDisplayUnits(JointType.REVOLUTE, 180)).toBeCloseTo(Math.PI)
	})

	it('leaves a prismatic value in mm', () => {
		expect(toDisplayUnits(JointType.PRISMATIC, 40)).toBe(40)
		expect(fromDisplayUnits(JointType.PRISMATIC, 40)).toBe(40)
	})

	it('names the unit', () => {
		expect(unitSuffix(JointType.REVOLUTE)).toBe('deg')
		expect(unitSuffix(JointType.PRISMATIC)).toBe('mm')
	})
})
