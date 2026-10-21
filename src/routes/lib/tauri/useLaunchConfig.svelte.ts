import { invoke, isTauri } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'

import { useLogs } from '$lib/plugins/Logs/useLogs.svelte'

import {
	LAUNCH_CONFIG_COMMAND,
	LAUNCH_CONFIG_EVENT,
	type LaunchConfig,
	type LaunchConfigPayload,
	parseLaunchConfig,
} from './launchConfig'

export interface LaunchConfigState {
	readonly ready: boolean
	readonly current: LaunchConfig | undefined
	readonly error: string | undefined
}

export const useLaunchConfig = (): LaunchConfigState => {
	let ready = $state(!isTauri())
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

	if (isTauri()) {
		$effect(() => {
			let isCancelled = false
			let hasEvent = false

			const unlistening = listen<LaunchConfigPayload>(LAUNCH_CONFIG_EVENT, (event) => {
				hasEvent = true
				apply(event.payload)
			})

			// Ask only once listening, so a relaunch between the two is not missed. An event that
			// lands before the answer is newer than it.
			unlistening
				.then(() => invoke<LaunchConfigPayload | null>(LAUNCH_CONFIG_COMMAND))
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
				unlistening.then((unlisten) => unlisten())
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
