import { MathUtils, Matrix4, Vector3 } from 'three'
import { describe, expect, it } from 'vitest'

import { recoverJointValue } from '../recover-joint-value'

const Z_AXIS = new Vector3(0, 0, 1)
const turnedAboutZ = (degrees: number) => new Matrix4().makeRotationZ(MathUtils.degToRad(degrees))
const limitsInDegrees = (lower: number, upper: number) => ({
	lower: MathUtils.degToRad(lower),
	upper: MathUtils.degToRad(upper),
})

describe('recoverJointValue', () => {
	it.each([
		{
			case: 'past -120° in a ±180° range',
			degrees: -150,
			limits: limitsInDegrees(-180, 180),
			expected: -2.617994,
		},
		{ case: 'past -120° with no limits', degrees: -150, limits: undefined, expected: -2.617994 },
		{
			case: 'below zero in a 0° to 360° range',
			degrees: -90,
			limits: limitsInDegrees(0, 360),
			expected: 4.712389,
		},
		{
			case: 'past 180° in a ±360° range',
			degrees: 200,
			limits: limitsInDegrees(-360, 360),
			expected: -2.792527,
		},
		{
			case: 'positive in a ±360° range',
			degrees: 100,
			limits: limitsInDegrees(-360, 360),
			expected: 1.745329,
		},
	])(
		'reads a revolute joint turned $case as an angle within its limits',
		({ degrees, limits, expected }) => {
			const joint = { type: 'revolute' as const, axis: Z_AXIS, limits }

			const value = recoverJointValue(joint, turnedAboutZ(degrees), new Matrix4())

			expect(value).toBeCloseTo(expected, 6)
		}
	)
})
