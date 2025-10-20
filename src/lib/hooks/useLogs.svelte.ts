import { getContext, setContext, untrack } from 'svelte'
import { MathUtils } from 'three'

const key = Symbol('logs-context')

type Level = 'info' | 'warn' | 'error'

interface Log {
	uuid: string
	message: string
	count: number
	level: Level
	timestamp: string
}

interface Context {
	current: Log[]
	errors: Log[]
	warnings: Log[]
	add(message: string, level?: Level): void
}

export const provideLogs = () => {
	const logs = $state<Log[]>([])
	const warnings = $state<Log[]>([])
	const errors = $state<Log[]>([])

	const intl = new Intl.DateTimeFormat('en-US', {
		dateStyle: 'short',
		timeStyle: 'short',
	})

	setContext<Context>(key, {
		get current() {
			return logs
		},
		get errors() {
			return errors
		},
		get warnings() {
			return warnings
		},
		add(message, level = 'info') {
			untrack(() => {
				const timestamp = intl.format(Date.now())
				const match = logs.find(
					(log) => log.message === message && log.level === level && log.timestamp === timestamp
				)

				if (match) {
					match.count += 1
				} else {
					const log: Log = {
						timestamp,
						message,
						count: 1,
						level,
						uuid: MathUtils.generateUUID(),
					}

					logs.unshift(log)

					if (level === 'error') {
						errors.unshift(log)
					} else if (level === 'warn') {
						warnings.unshift(log)
					}
				}

				if (logs.length > 200) {
					const log = logs.pop()

					if (log && level === 'error') {
						errors.splice(errors.indexOf(log), 1)
					} else if (log && level === 'warn') {
						warnings.splice(errors.indexOf(log), 1)
					}
				}
			})
		},
	})
}

export const useLogs = () => {
	return getContext<Context>(key)
}
