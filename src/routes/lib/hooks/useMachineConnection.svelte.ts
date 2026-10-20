import { type DialConf, MachineConnectionEvent } from '@viamrobotics/sdk'
import { useRobotConnection } from '@viamrobotics/svelte-sdk'
import { getContext, setContext, untrack } from 'svelte'

const INITIAL_DELAY_MS = 1000
const MAX_DELAY_MS = 60_000
const BACKOFF_FACTOR = 2
const TICK_MS = 500

const key = Symbol('machine-connection-context')

interface Context {
	connectionStatus: MachineConnectionEvent
	error: Error | undefined
	isAwaitingRetry: boolean
	secondsUntilRetry: number
	retryNow: () => void
}

const isTerminal = (status: MachineConnectionEvent) =>
	status === MachineConnectionEvent.DISCONNECTED ||
	status === MachineConnectionEvent.RECONNECTION_FAILED

export const provideMachineConnection = (
	partID: () => string,
	dialConfig: () => DialConf | undefined
): Context => {
	const robotConnection = useRobotConnection(partID)

	let attempts = $state(0)
	let nextRetryAt = $state<number | null>(null)
	let now = $state(performance.now())

	let retryTimer: number | null = null
	let ticker: number | null = null

	const clearRetry = () => {
		if (retryTimer !== null) {
			clearTimeout(retryTimer)
			retryTimer = null
		}
		if (ticker !== null) {
			clearInterval(ticker)
			ticker = null
		}
		nextRetryAt = null
	}

	const tryConnect = () => {
		clearRetry()
		const config = dialConfig()
		if (!config) {
			return
		}
		attempts += 1
		// Status updates flow back through useRobotConnection's listener. A failed dial
		// returns the status to DISCONNECTED, and the watcher below schedules the retry.
		void robotConnection.connect(config)
	}

	const scheduleRetry = () => {
		const delay = Math.min(INITIAL_DELAY_MS * BACKOFF_FACTOR ** attempts, MAX_DELAY_MS)
		const timestamp = performance.now()
		nextRetryAt = timestamp + delay
		now = timestamp
		retryTimer = window.setTimeout(tryConnect, delay)
		ticker = window.setInterval(() => {
			now = performance.now()
		}, TICK_MS)
	}

	const retryNow = () => {
		attempts = 0
		tryConnect()
	}

	$effect(() => {
		if (robotConnection.connectionStatus === MachineConnectionEvent.CONNECTED) {
			attempts = 0
		}
	})

	$effect(() => {
		const status = robotConnection.connectionStatus
		const config = dialConfig()

		if (isTerminal(status) && config !== undefined) {
			untrack(() => {
				if (retryTimer === null) {
					scheduleRetry()
				}
			})
		} else {
			untrack(clearRetry)
		}
	})

	$effect.pre(() => {
		partID()
		untrack(() => {
			attempts = 0
			clearRetry()
		})
	})

	$effect(() => {
		const handleOnline = () => {
			if (nextRetryAt !== null) {
				retryNow()
			}
		}
		const handleVisibility = () => {
			if (document.visibilityState === 'visible' && nextRetryAt !== null) {
				retryNow()
			}
		}

		window.addEventListener('online', handleOnline)
		document.addEventListener('visibilitychange', handleVisibility)
		return () => {
			window.removeEventListener('online', handleOnline)
			document.removeEventListener('visibilitychange', handleVisibility)
			clearRetry()
		}
	})

	const context: Context = {
		get connectionStatus() {
			return robotConnection.connectionStatus
		},
		get error() {
			return robotConnection.error
		},
		get isAwaitingRetry() {
			return nextRetryAt !== null
		},
		get secondsUntilRetry() {
			if (nextRetryAt === null) {
				return 0
			}
			return Math.max(0, Math.ceil((nextRetryAt - now) / 1000))
		},
		retryNow,
	}

	setContext<Context>(key, context)

	return context
}

export const useMachineConnection = (): Context => {
	return getContext<Context>(key)
}
