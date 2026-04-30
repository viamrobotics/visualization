const INITIAL_DELAY_MS = 1_000
const MAX_DELAY_MS = 30_000

/**
 * Calls `run` in a loop, retrying with exponential backoff when it throws.
 * Stops when the signal is aborted or `run` resolves without throwing.
 */
export const retryStream = async (
	run: (signal: AbortSignal) => Promise<void>,
	signal: AbortSignal,
	onRetry?: (delay: number) => void
): Promise<void> => {
	let delay = INITIAL_DELAY_MS

	while (!signal.aborted) {
		try {
			await run(signal)
			// Stream ended cleanly (server closed it) — restart from the beginning.
			delay = INITIAL_DELAY_MS
		} catch {
			if (signal.aborted) return
		}

		if (signal.aborted) return

		onRetry?.(delay)
		await sleep(delay, signal)
		delay = Math.min(delay * 2, MAX_DELAY_MS)
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
