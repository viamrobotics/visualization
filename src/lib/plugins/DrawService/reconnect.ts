import { Code, ConnectError } from '@connectrpc/connect'

const INITIAL_DELAY_MS = 1_000
const MAX_DELAY_MS = 30_000

export interface ReconnectOptions {
	/** Aborting this stops the loop. No further attempts are scheduled. */
	signal: AbortSignal
	initialDelay?: number
	maxDelay?: number
	/** Runs before every attempt, including the first. Use it to clear local state. */
	onBeforeAttempt: () => void
	/**
	 * One connection attempt. Resolves or rejects when the connection ends. Call `onData` once
	 * the connection has produced something, which resets the backoff.
	 */
	run: (signal: AbortSignal, onData: () => void) => Promise<void>
	/** Called when an attempt ends without the loop being aborted. */
	onStatus?: (connected: boolean) => void
	/** Reports a failed attempt somewhere the user can see. Resync requests are not failures. */
	onError?: (error: unknown) => void
}

/** Resolve after ms, or immediately when the signal aborts. */
const sleep = (ms: number, signal: AbortSignal): Promise<void> =>
	new Promise((resolve) => {
		if (signal.aborted) {
			resolve()
			return
		}
		const timer = setTimeout(() => {
			signal.removeEventListener('abort', onAbort)
			resolve()
		}, ms)
		const onAbort = () => {
			clearTimeout(timer)
			resolve()
		}
		signal.addEventListener('abort', onAbort, { once: true })
	})

/**
 * A stream overflow is the server asking for a resync, not a failure. Reconnecting immediately
 * is correct: the replay on connect is exactly the snapshot the consumer needs.
 */
const isResyncRequest = (error: unknown): boolean =>
	error instanceof ConnectError && error.code === Code.ResourceExhausted

/**
 * Run a streaming connection, restarting it with exponential backoff until the signal aborts.
 *
 * Each attempt gets its own AbortController chained to the outer signal. Work started by an
 * attempt (chunk pulls, in particular) must be cancelled when that attempt ends, not only when
 * the whole loop stops — otherwise a reconnect leaves the previous attempt writing into
 * entities the resync already destroyed.
 */
export const runWithReconnect = async (options: ReconnectOptions): Promise<void> => {
	const {
		signal,
		onBeforeAttempt,
		run,
		onStatus,
		onError,
		initialDelay = INITIAL_DELAY_MS,
		maxDelay = MAX_DELAY_MS,
	} = options

	let delay = initialDelay

	while (!signal.aborted) {
		const attempt = new AbortController()
		const abortAttempt = () => attempt.abort()
		signal.addEventListener('abort', abortAttempt, { once: true })

		let resync = false
		// Reset on data received rather than on the attempt completing. A server that accepts the
		// connection and immediately drops it would otherwise defeat the backoff entirely.
		const onData = () => {
			delay = initialDelay
		}

		try {
			onBeforeAttempt()
			await run(attempt.signal, onData)
		} catch (error) {
			if (isResyncRequest(error)) {
				resync = true
			} else if (!signal.aborted) {
				console.error('Draw service stream error:', error)
				onError?.(error)
			}
		} finally {
			attempt.abort()
			signal.removeEventListener('abort', abortAttempt)
		}

		if (signal.aborted) break

		onStatus?.(false)

		if (resync) {
			delay = initialDelay
			continue
		}

		await sleep(delay, signal)
		delay = Math.min(delay * 2, maxDelay)
	}
}
