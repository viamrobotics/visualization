import { getContext, setContext } from 'svelte'

import { backendIP, drawServicePort } from '#lib/defines.js'

import { useDrawServicePort } from '../desktop/useDrawServicePort.svelte'
import { readDrawServicePortOverride } from '../readDrawServicePortOverride'

const key = Symbol('draw-server-context')

interface DrawServerContext {
	/** False until the desktop shell has answered with its sidecar port. Always true in a browser. */
	readonly ready: boolean
	readonly port: string
	readonly url: string
}

/**
 * Resolves the draw server's port: a `?drawPort=` override first, then the desktop sidecar's
 * port, then the build default.
 */
export const provideDrawServer = (search: () => string): DrawServerContext => {
	const sidecar = useDrawServicePort()

	const port = $derived(readDrawServicePortOverride(search()) ?? sidecar.port ?? drawServicePort)
	const url = $derived(`http://${backendIP}:${port}`)

	const context: DrawServerContext = {
		get ready() {
			return sidecar.ready
		},
		get port() {
			return port
		},
		get url() {
			return url
		},
	}

	setContext(key, context)

	return context
}

export const useDrawServer = (): DrawServerContext => getContext(key)
