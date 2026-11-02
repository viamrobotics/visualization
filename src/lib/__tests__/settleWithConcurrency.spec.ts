import { describe, expect, it } from 'vitest'

import { settleWithConcurrency } from '../settleWithConcurrency'

describe('settleWithConcurrency', () => {
	it('never has more than `limit` tasks in flight', async () => {
		let inFlight = 0
		let mostInFlight = 0

		await settleWithConcurrency([1, 2, 3, 4, 5, 6, 7], 3, async () => {
			inFlight++
			mostInFlight = Math.max(mostInFlight, inFlight)
			await new Promise((resolve) => setTimeout(resolve))
			inFlight--
		})

		expect(mostInFlight).toBe(3)
	})

	it('runs every item at once for an `Infinity` limit', async () => {
		let inFlight = 0
		let mostInFlight = 0

		await settleWithConcurrency([1, 2, 3, 4, 5], Infinity, async () => {
			inFlight++
			mostInFlight = Math.max(mostInFlight, inFlight)
			await new Promise((resolve) => setTimeout(resolve))
			inFlight--
		})

		expect(mostInFlight).toBe(5)
	})

	it('keeps results in the order of the items, rejections included', async () => {
		const results = await settleWithConcurrency([30, 0, 10], 2, async (delay) => {
			await new Promise((resolve) => setTimeout(resolve, delay))
			if (delay === 0) throw new Error('zero')
			return delay
		})

		expect(results.map((result) => result.status)).toEqual(['fulfilled', 'rejected', 'fulfilled'])
		expect(results.map((result) => (result.status === 'fulfilled' ? result.value : null))).toEqual([
			30,
			null,
			10,
		])
	})
})
