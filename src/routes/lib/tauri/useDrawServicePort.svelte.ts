import { invoke, isTauri } from '@tauri-apps/api/core'

import { DRAW_SERVICE_PORT_COMMAND, type DrawServicePortPayload } from './drawServicePort'

export interface DrawServicePortState {
	readonly ready: boolean
	readonly port: string | undefined
}

export const useDrawServicePort = (): DrawServicePortState => {
	let ready = $state(false)
	let port = $state<string | undefined>(undefined)

	if (isTauri()) {
		invoke<DrawServicePortPayload>(DRAW_SERVICE_PORT_COMMAND)
			.then((payload) => {
				port = payload === null ? undefined : String(payload)
			})
			.catch((error: unknown) => {
				console.warn('Failed to read the draw server port from Tauri', error)
			})
			.finally(() => {
				ready = true
			})
	} else {
		ready = true
	}

	return {
		get ready() {
			return ready
		},
		get port() {
			return port
		},
	}
}
