import { describe, expect, it } from 'vitest'

import { transformSnaps } from '../transformSnaps'

const snapSettings = { snapping: true, snapTranslate: 0.25, snapRotate: 90, snapScale: 0.1 }

describe('transformSnaps', () => {
	it('passes a move step through in the metres the gizmo snaps in', () => {
		expect(transformSnaps(snapSettings).translation).toBe(0.25)
	})

	it('converts a degree rotate step to radians', () => {
		expect(transformSnaps(snapSettings).rotation).toBeCloseTo(Math.PI / 2)
	})

	it('passes a scale step through as a factor', () => {
		expect(transformSnaps(snapSettings).scale).toBe(0.1)
	})

	it('snaps nothing while snapping is off', () => {
		expect(transformSnaps({ ...snapSettings, snapping: false })).toEqual({
			translation: null,
			rotation: null,
			scale: null,
		})
	})

	it('leaves an axis free when its step is 0', () => {
		expect(transformSnaps({ ...snapSettings, snapTranslate: 0 }).translation).toBeNull()
	})
})
