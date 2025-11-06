import { getContext, setContext } from 'svelte'

interface Context {
	anchors: XRAnchor[]
}

const key = Symbol('anchors-context')

export const provideAnchors = () => {
	setContext<Context>(key, {
		get anchors() {
			return []
		},
	})
}

export const useAnchors = () => {
	return getContext<Context>(key)
}
