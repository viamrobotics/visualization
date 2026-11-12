import { Quaternion, Vector3 } from 'three'
import { describe, expect, it } from 'vitest'

import { alignUpToNormal } from '../alignUpToNormal'

describe('alignUpToNormal', () => {
	it('points +Z along the normal', () => {
		const normal = new Vector3(1, 0, 1).normalize()
		const aligned = alignUpToNormal(new Quaternion(), normal, new Quaternion())

		expect(new Vector3(0, 0, 1).applyQuaternion(aligned).distanceTo(normal)).toBeCloseTo(0)
	})

	it('keeps the heading about a normal that is already up', () => {
		const heading = new Quaternion().setFromAxisAngle(new Vector3(0, 0, 1), 0.7)
		const aligned = alignUpToNormal(heading, new Vector3(0, 0, 1), new Quaternion())

		expect(aligned.angleTo(heading)).toBeCloseTo(0)
	})

	it('keeps +X level when tilting toward Y', () => {
		const normal = new Vector3(0, -1, 1).normalize()
		const aligned = alignUpToNormal(new Quaternion(), normal, new Quaternion())

		expect(
			new Vector3(1, 0, 0).applyQuaternion(aligned).distanceTo(new Vector3(1, 0, 0))
		).toBeCloseTo(0)
	})
})
