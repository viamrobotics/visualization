import { getContext, setContext } from 'svelte'

export const ENVIRONMENT_CONTEXT_KEY = Symbol('environment')

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

export const createEnvironment = (): Context => {
	const environment = $state<Environemnt>(defaults())

	const context: Context = {
		get current() {
			return environment
		},
	}

	return context
}

export const provideEnvironment = () => {
	const context = createEnvironment()
	setContext<Context>(ENVIRONMENT_CONTEXT_KEY, context)
	return context

}

export const useEnvironment = () => {
	return getContext<Context>(ENVIRONMENT_CONTEXT_KEY)
}
