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
	add(message: string, level?: Level): void
}

export const provideLogs = () => {
	const logs = $state<Log[]>([])

	const intl = new Intl.DateTimeFormat('en-US', {
		dateStyle: 'short',
		timeStyle: 'short',
	})

	setContext<Context>(key, {
		get current() {
			return logs
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
					logs.unshift({
						message,
						count: 1,
						level,
						uuid: MathUtils.generateUUID(),
						timestamp: intl.format(Date.now()),
					})
				}

				if (logs.length > 200) {
					logs.pop()
				}
			})
		},
	})
}

export const useLogs = () => {
	return getContext<Context>(key)
}
