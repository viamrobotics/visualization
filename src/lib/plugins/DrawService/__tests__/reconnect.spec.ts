import { Code, ConnectError } from '@connectrpc/connect'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { runWithReconnect } from '../reconnect'

/** Let queued microtasks settle, then advance fake timers past the pending backoff. */
const advance = async (ms: number) => {
	await Promise.resolve()
	await vi.advanceTimersByTimeAsync(ms)
}

/**
 * Records the gap before each attempt. The first entry is always 0 (the first attempt is
 * immediate), so a run of failures reads as the backoff sequence.
 */
const attemptDelays = () => {
	const stamps: number[] = []
	return {
		record: () => stamps.push(Date.now()),
		gaps: () => stamps.map((stamp, i) => (i === 0 ? 0 : stamp - stamps[i - 1])),
	}
}

describe('runWithReconnect', () => {
	beforeEach(() => vi.useFakeTimers())
	afterEach(() => vi.useRealTimers())

	it('clears local state before every attempt, including the first', async () => {
		const controller = new AbortController()
		const onBeforeAttempt = vi.fn()
		let attempts = 0

		const loop = runWithReconnect({
			signal: controller.signal,
			onBeforeAttempt,
			run: async () => {
				attempts += 1
				if (attempts >= 3) controller.abort()
				throw new Error('dropped')
			},
			initialDelay: 100,
		})

		await advance(1000)
		await loop

		expect(onBeforeAttempt).toHaveBeenCalledTimes(3)
	})

	it('backs off exponentially up to the cap', async () => {
		const controller = new AbortController()
		const delays = attemptDelays()

		const loop = runWithReconnect({
			signal: controller.signal,
			onBeforeAttempt: delays.record,
			run: async () => {
				throw new Error('dropped')
			},
			initialDelay: 1000,
			maxDelay: 4000,
		})

		for (let i = 0; i < 6; i += 1) await advance(5000)
		controller.abort()
		await advance(0)
		await loop

		expect(delays.gaps().slice(1, 5)).toEqual([1000, 2000, 4000, 4000])
	})

	it('resets the backoff once an attempt produces data', async () => {
		const controller = new AbortController()
		const delays = attemptDelays()
		let attempts = 0

		const loop = runWithReconnect({
			signal: controller.signal,
			onBeforeAttempt: delays.record,
			run: async (_signal, onData) => {
				attempts += 1
				if (attempts === 3) onData()
				throw new Error('dropped')
			},
			initialDelay: 1000,
			maxDelay: 60_000,
		})

		for (let i = 0; i < 5; i += 1) await advance(70_000)
		controller.abort()
		await advance(0)
		await loop

		expect(delays.gaps().slice(1, 5)).toEqual([1000, 2000, 1000, 2000])
	})

	it('reconnects immediately when the server asks for a resync', async () => {
		const controller = new AbortController()
		const delays = attemptDelays()
		let attempts = 0

		const loop = runWithReconnect({
			signal: controller.signal,
			onBeforeAttempt: delays.record,
			run: async () => {
				attempts += 1
				if (attempts >= 4) controller.abort()
				throw new ConnectError('too far behind', Code.ResourceExhausted)
			},
			initialDelay: 5000,
		})

		await advance(100)
		await loop

		expect(delays.gaps()).toEqual([0, 0, 0, 0])
	})

	it('stops without scheduling another attempt once aborted', async () => {
		const controller = new AbortController()
		const run = vi.fn(async () => {
			throw new Error('dropped')
		})

		const loop = runWithReconnect({
			signal: controller.signal,
			onBeforeAttempt: () => {},
			run,
			initialDelay: 1000,
		})

		await advance(0)
		controller.abort()
		await advance(60_000)
		await loop

		expect(run).toHaveBeenCalledTimes(1)
	})

	it('does not start at all when the signal is already aborted', async () => {
		const controller = new AbortController()
		controller.abort()
		const run = vi.fn(async () => {})

		await runWithReconnect({
			signal: controller.signal,
			onBeforeAttempt: () => {},
			run,
		})

		expect(run).not.toHaveBeenCalled()
	})

	it('aborts the per-attempt signal when an attempt ends', async () => {
		const controller = new AbortController()
		const signals: AbortSignal[] = []
		let attempts = 0

		const loop = runWithReconnect({
			signal: controller.signal,
			onBeforeAttempt: () => {},
			run: async (signal) => {
				signals.push(signal)
				attempts += 1
				if (attempts >= 2) controller.abort()
				throw new Error('dropped')
			},
			initialDelay: 10,
		})

		await advance(1000)
		await loop

		// Work started by an attempt must not outlive it, or a reconnect leaves the previous
		// attempt writing into entities the resync already destroyed.
		expect(signals).toHaveLength(2)
		expect(signals.every((signal) => signal.aborted)).toBe(true)
		expect(signals[0]).not.toBe(signals[1])
	})
})
