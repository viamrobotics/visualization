import { useLogs } from '$lib/plugins/Logs/useLogs.svelte'

import { getDesktopBridge } from './desktopBridge'
import { type LaunchConfig, type LaunchConfigPayload, parseLaunchConfig } from './launchConfig'

export interface LaunchConfigState {
	readonly ready: boolean
	readonly current: LaunchConfig | undefined
	readonly error: string | undefined
}

export const useLaunchConfig = (): LaunchConfigState => {
	const bridge = getDesktopBridge()

	let ready = $state(!bridge)
	let current = $state.raw<LaunchConfig | undefined>(undefined)
	let error = $state<string | undefined>(undefined)

	const logs = useLogs()

	const getMessage = (cause: unknown) => (cause instanceof Error ? cause.message : String(cause))

	const fail = (message: string) => {
		error = message
		logs.add(`Launch file: ${message}`, 'error')
	}

	const apply = (payload: LaunchConfigPayload | null) => {
		current = undefined
		error = undefined

		if (payload === null) return
		if (payload.error) {
			fail(payload.error)
			return
		}

		if (payload.config === null) return
		try {
			current = parseLaunchConfig(payload.config)
		} catch (error_) {
			fail(getMessage(error_))
		}
	}

	if (bridge) {
		$effect(() => {
			let isCancelled = false
			let hasEvent = false

			// Subscribe before asking, so a relaunch between the two is not missed. An event that
			// lands before the answer is newer than it.
			const unsubscribe = bridge.onLaunchConfigChanged((payload) => {
				hasEvent = true
				apply(payload)
			})

			bridge
				.launchConfig()
				.then((payload) => {
					if (!isCancelled && !hasEvent) apply(payload)
				})
				.catch((error_: unknown) => {
					if (!isCancelled) fail(getMessage(error_))
				})
				.finally(() => {
					if (!isCancelled) ready = true
				})

			return () => {
				isCancelled = true
				unsubscribe()
			}
		})
	}

	return {
		get ready() {
			return ready
		},
		get current() {
			return current
		},
		get error() {
			return error
		},
	}
}
