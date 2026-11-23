import { describe, expect, it } from 'vitest'

import { Pose } from '#lib/math/index.js'

import { sharedPose } from '../sharedPose'
import { MIXED } from '../sharedValue'

describe('sharedPose', () => {
	it('shows one orientation for the same rotation spelled with theta 180 and -180', () => {
		const shared = sharedPose([new Pose(0, 0, 0, 0, 0, 1, 180), new Pose(0, 0, 0, 0, 0, 1, -180)])

		expect(shared).toMatchObject({ oX: 0, oY: 0, oZ: 1, theta: 180 })
	})

	it('marks only the orientation fields that differ when the rotations differ', () => {
		const shared = sharedPose([new Pose(0, 0, 0, 0, 0, 1, 90), new Pose(0, 0, 0, 0, 0, 1, 45)])

		expect(shared).toMatchObject({ oX: 0, oY: 0, oZ: 1, theta: MIXED })
	})
})
