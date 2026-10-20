import { describe, expect, it } from 'vitest'

import { frameToPose, poseToFrame } from '../poseFrame'

describe('poseToFrame', () => {
	it('maps a pose to a translation and an ov_degrees orientation', () => {
		const frame = poseToFrame({ x: 1, y: 2, z: 3, oX: 0, oY: 1, oZ: 0, theta: 90 })

		expect(frame.translation).toEqual({ x: 1, y: 2, z: 3 })
		expect(frame.orientation).toEqual({
			type: 'ov_degrees',
			value: { x: 0, y: 1, z: 0, th: 90 },
		})
	})

	it('reads an absent pose as the origin with no rotation', () => {
		const frame = poseToFrame(undefined)

		expect(frame.translation).toEqual({ x: 0, y: 0, z: 0 })
		expect(frame.orientation).toEqual({ type: 'ov_degrees', value: { x: 0, y: 0, z: 1, th: 0 } })
	})
})

describe('frameToPose', () => {
	it('round-trips an ov_degrees pose', () => {
		const pose = { x: 10, y: 20, z: 30, oX: 0, oY: 0, oZ: 1, theta: 45 }

		expect(frameToPose(poseToFrame(pose))).toEqual(pose)
	})

	it('converts a quaternion orientation to an OV in degrees', () => {
		const half = Math.SQRT1_2
		const pose = frameToPose({
			translation: { x: 0, y: 0, z: 0 },
			orientation: { type: 'quaternion', value: { x: 0, y: 0, z: half, w: half } },
		})

		expect(pose.oZ).toBeCloseTo(1)
		expect(pose.theta).toBeCloseTo(90)
	})
})
