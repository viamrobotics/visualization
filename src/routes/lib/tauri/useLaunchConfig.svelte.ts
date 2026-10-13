import { invoke, isTauri } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'

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
	let ready = $state(false)
	let current = $state.raw<LaunchConfig | undefined>(undefined)
	let error = $state<string | undefined>(undefined)

	const getMessage = (cause: unknown) => (cause instanceof Error ? cause.message : String(cause))

	const apply = (payload: LaunchConfigPayload | null) => {
		current = undefined
		error = undefined

		if (payload === null) return
		if (payload.error) {
			error = payload.error
			return
		}

		if (payload.config === null) return
		try {
			current = parseLaunchConfig(payload.config)
		} catch (error_) {
			error = getMessage(error_)
		}
	}

	if (isTauri()) {
		invoke<LaunchConfigPayload | null>(LAUNCH_CONFIG_COMMAND)
			.then(apply)
			.catch((error_: unknown) => {
				error = getMessage(error_)
			})
			.finally(() => {
				ready = true
			})

		$effect(() => {
			const unlistening = listen<LaunchConfigPayload>(LAUNCH_CONFIG_EVENT, (event) => {
				apply(event.payload)
			})

			return () => {
				unlistening.then((unlisten) => unlisten())
			}
		})
	} else {
		ready = true
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
