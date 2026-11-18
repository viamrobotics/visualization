import { getContext, setContext } from 'svelte'

import { type DeepLinkParams, readDeepLinkParams } from './readDeepLinkParams'

export const DEEP_LINK_CONTEXT_KEY = Symbol('deep-link')

interface DeepLinkContext {
	/**
	 * The values under `key` the first time it is asked for, and `undefined` from
	 * then on and whenever the key is absent. One page load, one consumer per key.
	 */
	consume: (key: string) => readonly string[] | undefined
}

export const createDeepLink = (params: DeepLinkParams): DeepLinkContext => {
	const consumedKeys = new Set<string>()

	return {
		consume: (key) => {
			if (consumedKeys.has(key)) return undefined

			const values = params.get(key)
			if (!values) return undefined

			consumedKeys.add(key)
			return values
		},
	}
}

/**
 * Reads the page's own query string once, in setup. A deep link is a page-load
 * intent, not live state, so a later URL change is not observed. Only
 * `viz.`-prefixed keys are honored, so a host page's parameters never collide.
 */
export const provideDeepLink = (): DeepLinkContext => {
	const value = globalThis.location?.search ?? ''
	const context = createDeepLink(readDeepLinkParams(value))
	setContext<DeepLinkContext>(DEEP_LINK_CONTEXT_KEY, context)
	return context
}

const useDeepLink = (): DeepLinkContext => {
	return getContext<DeepLinkContext>(DEEP_LINK_CONTEXT_KEY)
}

/**
 * Runs `apply` once, in setup, when `viz.<key>` is present and no consumer has
 * claimed it yet. The contribution point plugins use to claim their own
 * parameter, shaped like `useHotkey`: declare while mounted, core owns the set.
 */
export const useDeepLinkParam = (key: string, apply: (values: readonly string[]) => void): void => {
	const values = useDeepLink().consume(key)
	if (values) apply(values)
}
