import { getContext, setContext } from 'svelte'

export interface DrawConnectionConfig {
	backendIP: string
	websocketPort: string
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
