import { getContext, setContext } from 'svelte'

const key = Symbol('environment')

interface Environemnt {
	viewerMode: 'edit' | 'monitor'
	isStandalone: boolean
}

interface Context {
	current: Environemnt
}

const defaults = (): Environemnt => ({
	viewerMode: 'monitor',
	isStandalone: true,
})

export const provideEnvironment = () => {
	const environment = $state<Environemnt>(defaults())

	const context: Context = {
		get current() {
			return environment
		},
	}

	setContext<Context>(key, context)

	return context
}

export const useEnvironment = () => {
	return getContext<Context>(key)
}
