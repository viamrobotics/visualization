import { getContext, setContext } from 'svelte'

/** Port the Go draw server listens on. Matches `draw-server -port`. */
export const DEFAULT_DRAW_SERVICE_PORT = '3030'

export interface DrawConnectionConfig {
	backendIP: string
	/** Defaults to {@link DEFAULT_DRAW_SERVICE_PORT}. */
	port?: string
}

interface Context {
	current: DrawConnectionConfig | undefined
}

const key = Symbol('draw-connection-config-key')

export const provideDrawConnectionConfig = (args: () => DrawConnectionConfig | undefined) => {
	const current = $derived(args())

	setContext<Context>(key, {
		get current() {
			return current
		},
	})
}

export const useDrawConnectionConfig = (): Context => {
	return getContext<Context>(key)
}
