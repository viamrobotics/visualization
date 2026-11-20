import { describe, expect, it } from 'vitest'

import { verticalFovDegrees } from '../cameraIntrinsics'

describe('verticalFovDegrees', () => {
	it('is 90° when the focal length is half the image height', () => {
		expect(
			verticalFovDegrees({
				widthPx: 100,
				heightPx: 100,
				focalXPx: 50,
				focalYPx: 50,
				centerXPx: 50,
				centerYPx: 50,
			})
		).toBeCloseTo(90, 6)
	})

	it('reads the vertical focal length, not the horizontal one', () => {
		expect(
			verticalFovDegrees({
				widthPx: 200,
				heightPx: 100,
				focalXPx: 10,
				focalYPx: 50,
				centerXPx: 100,
				centerYPx: 50,
			})
		).toBeCloseTo(90, 6)
	})
})
