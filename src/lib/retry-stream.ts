const INITIAL_DELAY_MS = 1_000
const MAX_DELAY_MS = 30_000

/**
 * Calls `run` in a loop, retrying with exponential backoff when it throws.
 * - Clean stream end (server closed it): restarts immediately, delay resets.
 * - Error: calls `onRetry`, waits with exponential backoff, then retries.
 * Stops when the signal is aborted.
 */
export const retryStream = async (
	run: (signal: AbortSignal) => Promise<void>,
	signal: AbortSignal,
	onRetry?: (delay: number) => void
): Promise<void> => {
	let delay = INITIAL_DELAY_MS

	while (!signal.aborted) {
		let errored = false
		try {
			await run(signal)
			// Stream ended cleanly (server closed it) — restart immediately.
			delay = INITIAL_DELAY_MS
		} catch (error) {
			if (signal.aborted) return
			errored = true
			console.warn('Stream error, retrying in', delay, 'ms:', error)
		}

		if (signal.aborted) return

		if (errored) {
			onRetry?.(delay)
			await sleep(delay, signal)
			delay = Math.min(delay * 2, MAX_DELAY_MS)
		}
	}
}

const sleep = (ms: number, signal: AbortSignal): Promise<void> => {
	return new Promise((resolve) => {
		const timer = setTimeout(resolve, ms)
		signal.addEventListener(
			'abort',
			() => {
				clearTimeout(timer)
				resolve()
			},
			{ once: true }
		)
	})
}
