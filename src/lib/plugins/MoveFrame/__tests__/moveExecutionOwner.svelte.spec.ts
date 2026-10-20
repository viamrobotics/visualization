import { describe, expect, it } from 'vitest'

import { moveExecutionOwner } from '../moveExecutionOwner.svelte'

describe('moveExecutionOwner', () => {
	it('names no frame before anything runs', () => {
		expect(moveExecutionOwner.movingFrame).toBeUndefined()
	})

	it('hands the lock to the first frame that asks', () => {
		expect(moveExecutionOwner.claim('arm')).toBe(true)
		expect(moveExecutionOwner.movingFrame).toBe('arm')

		moveExecutionOwner.release('arm')
	})

	it('refuses a second frame while the first is running', () => {
		moveExecutionOwner.claim('arm')

		expect(moveExecutionOwner.claim('gantry')).toBe(false)
		expect(moveExecutionOwner.movingFrame).toBe('arm')

		moveExecutionOwner.release('arm')
	})

	it('ignores a release from a frame that does not hold the lock', () => {
		moveExecutionOwner.claim('arm')

		moveExecutionOwner.release('gantry')

		expect(moveExecutionOwner.movingFrame).toBe('arm')
		moveExecutionOwner.release('arm')
	})

	it('lets the next frame in once the holder releases', () => {
		moveExecutionOwner.claim('arm')
		moveExecutionOwner.release('arm')

		expect(moveExecutionOwner.claim('gantry')).toBe(true)

		moveExecutionOwner.release('gantry')
	})
})
