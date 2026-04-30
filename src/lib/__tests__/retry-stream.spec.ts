import { describe, expect, it, vi } from 'vitest'

import { retryStream } from '../retry-stream'

describe('retryStream', () => {
	it('calls run and resolves when run succeeds', async () => {
		const run = vi.fn().mockResolvedValue(undefined)
		const controller = new AbortController()

		// run resolves once, retryStream will call it again — abort after first call
		run.mockImplementation(async () => {
			controller.abort()
		})

		await retryStream(run, controller.signal)

		expect(run).toHaveBeenCalledTimes(1)
	})

	it('retries when run throws', async () => {
		vi.useFakeTimers()

		const controller = new AbortController()
		let callCount = 0

		const run = vi.fn().mockImplementation(async () => {
			callCount++
			if (callCount < 3) {
				throw new Error('stream error')
			}
			controller.abort()
		})

		const promise = retryStream(run, controller.signal)
		// Advance through the backoff delays
		await vi.advanceTimersByTimeAsync(1_000)
		await vi.advanceTimersByTimeAsync(2_000)

		await promise

		expect(run).toHaveBeenCalledTimes(3)

		vi.useRealTimers()
	})

	it('stops retrying when signal is aborted', async () => {
		vi.useFakeTimers()

		const controller = new AbortController()
		const run = vi.fn().mockRejectedValue(new Error('stream error'))
		const onRetry = vi.fn()

		const promise = retryStream(run, controller.signal, onRetry)

		// First call fails immediately, then waits for backoff
		await vi.advanceTimersByTimeAsync(0)
		expect(run).toHaveBeenCalledTimes(1)

		// Abort during backoff wait
		controller.abort()
		await vi.advanceTimersByTimeAsync(1_000)

		await promise

		// Should have called onRetry once, but not retried run
		expect(onRetry).toHaveBeenCalledTimes(1)
		expect(run).toHaveBeenCalledTimes(1)

		vi.useRealTimers()
	})

	it('calls onRetry with the current delay', async () => {
		vi.useFakeTimers()

		const controller = new AbortController()
		let callCount = 0

		const run = vi.fn().mockImplementation(async () => {
			callCount++
			if (callCount < 3) {
				throw new Error('stream error')
			}
			controller.abort()
		})

		const onRetry = vi.fn()
		const promise = retryStream(run, controller.signal, onRetry)

		await vi.advanceTimersByTimeAsync(1_000)
		await vi.advanceTimersByTimeAsync(2_000)

		await promise

		expect(onRetry).toHaveBeenCalledTimes(2)
		expect(onRetry).toHaveBeenNthCalledWith(1, 1_000)
		expect(onRetry).toHaveBeenNthCalledWith(2, 2_000)

		vi.useRealTimers()
	})

	it('does not call onRetry and restarts immediately on clean stream end', async () => {
		const controller = new AbortController()
		let callCount = 0

		const run = vi.fn().mockImplementation(async () => {
			callCount++
			if (callCount === 1) return // clean end — server closed the stream
			controller.abort()
		})

		const onRetry = vi.fn()
		await retryStream(run, controller.signal, onRetry)

		expect(run).toHaveBeenCalledTimes(2)
		expect(onRetry).not.toHaveBeenCalled()
	})

	it('resets delay after a successful run', async () => {
		vi.useFakeTimers()

		const controller = new AbortController()
		let callCount = 0

		const run = vi.fn().mockImplementation(async () => {
			callCount++
			// First call: fail
			if (callCount === 1) throw new Error('fail')
			// Second call: succeed (stream ended cleanly)
			if (callCount === 2) return
			// Third call: fail
			if (callCount === 3) throw new Error('fail')
			// Fourth call: abort
			controller.abort()
		})

		const onRetry = vi.fn()
		const promise = retryStream(run, controller.signal, onRetry)

		// First failure + 1s backoff
		await vi.advanceTimersByTimeAsync(1_000)
		// Second call succeeds, delay resets. Third call fails, should use 1s again
		await vi.advanceTimersByTimeAsync(1_000)
		// Fourth call - abort
		await vi.advanceTimersByTimeAsync(2_000)

		await promise

		// Both retries should have used 1000ms (reset after success)
		expect(onRetry).toHaveBeenNthCalledWith(1, 1_000)
		expect(onRetry).toHaveBeenNthCalledWith(2, 1_000)

		vi.useRealTimers()
	})
})
