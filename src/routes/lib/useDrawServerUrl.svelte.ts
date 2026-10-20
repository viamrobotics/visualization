import { page } from '$app/state'
import { backendIP, drawServicePort } from '$lib/defines'

import { readDrawServicePortOverride } from './readDrawServicePortOverride'
import { useDrawServicePort } from './tauri/useDrawServicePort.svelte'

export interface DrawServerUrl {
	/** False until the Tauri sidecar lookup settles. Always true outside Tauri. */
	readonly ready: boolean
	readonly port: string
	readonly baseUrl: string
}

/**
 * The draw server this window talks to: the `drawPort` query override, else the Tauri sidecar's
 * port, else the build-time default. Call it during component setup.
 */
export const useDrawServerUrl = (): DrawServerUrl => {
	const sidecar = useDrawServicePort()
	const port = $derived(
		readDrawServicePortOverride(page.url.search) ?? sidecar.port ?? drawServicePort
	)

	return {
		get ready() {
			return sidecar.ready
		},
		get port() {
			return port
		},
		get baseUrl() {
			return `http://${backendIP}:${port}`
		},
	}
}
