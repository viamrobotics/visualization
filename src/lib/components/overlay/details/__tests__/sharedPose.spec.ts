import { describe, expect, it } from 'vitest'

import { Pose } from '#lib/math/index.js'

import { sharedPose } from '../sharedPose'
import { MIXED } from '../sharedValue'

describe('sharedPose', () => {
	it('shows one orientation for the same rotation spelled with different axes', () => {
		const shared = sharedPose([new Pose(0, 0, 0, 0, 0, 1, 0), new Pose(0, 0, 0, 1, 0, 0, 0)])

		expect(shared).toMatchObject({ oX: 0, oY: 0, oZ: 1, theta: 0 })
	})

	it('marks only the orientation fields that differ when the rotations differ', () => {
		const shared = sharedPose([new Pose(0, 0, 0, 0, 0, 1, 90), new Pose(0, 0, 0, 0, 0, 1, 45)])

		expect(shared).toMatchObject({ oX: 0, oY: 0, oZ: 1, theta: MIXED })
	})
})
