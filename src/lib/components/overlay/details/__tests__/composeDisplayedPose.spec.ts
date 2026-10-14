import { describe, expect, it } from 'vitest'

import { Pose } from '$lib/math'

import { composeDisplayedPose } from '../composeDisplayedPose'

describe('composeDisplayedPose', () => {
	it('returns undefined without a transform or a center', () => {
		expect(composeDisplayedPose(undefined, undefined)).toBeUndefined()
	})

	it('returns the center when there is no transform', () => {
		const pose = composeDisplayedPose(undefined, { x: 10, y: 20, z: 30 })

		expect(pose?.x).toBe(10)
		expect(pose?.y).toBe(20)
		expect(pose?.z).toBe(30)
	})

	it('returns the transform pose when there is no center', () => {
		const pose = composeDisplayedPose(new Pose(1, 2, 3).toMatrix4(), undefined)

		expect(pose?.x).toBeCloseTo(1)
		expect(pose?.y).toBeCloseTo(2)
		expect(pose?.z).toBeCloseTo(3)
	})

	it('places the center at its own pose under an identity transform', () => {
		const pose = composeDisplayedPose(new Pose().toMatrix4(), {
			x: 100,
			y: -50,
			z: 25,
			oX: 0,
			oY: 0,
			oZ: 1,
			theta: 45,
		})

		expect(pose?.x).toBeCloseTo(100)
		expect(pose?.y).toBeCloseTo(-50)
		expect(pose?.z).toBeCloseTo(25)
		expect(pose?.oZ).toBeCloseTo(1)
		expect(pose?.theta).toBeCloseTo(45)
	})

	it('expresses the center in the transform frame', () => {
		const rotatedQuarterTurnAboutZ = new Pose(100, 0, 0, 0, 0, 1, 90).toMatrix4()
		const pose = composeDisplayedPose(rotatedQuarterTurnAboutZ, { x: 10 })

		expect(pose?.x).toBeCloseTo(100)
		expect(pose?.y).toBeCloseTo(10)
		expect(pose?.z).toBeCloseTo(0)
		expect(pose?.theta).toBeCloseTo(90)
	})
})
