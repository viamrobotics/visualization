import { getContext, setContext } from 'svelte'

const key = Symbol('part-id-context')

interface Context {
	current: string
}

export const createPartIDContext = (partId: () => string): Context => {
	const context: Context = {
		get current() {
			return partId()
		},
	}

	setContext<Context>(key, context)

	return context
}

export const usePartID = (): Context => {
	return getContext<Context>(key)
}
