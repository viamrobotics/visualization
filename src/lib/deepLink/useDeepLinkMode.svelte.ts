import {
	type EnvironmentContext,
	isEnvironmentMode,
	useEnvironment,
} from '$lib/hooks/useEnvironment.svelte'

import { useDeepLinkParam } from './useDeepLink.svelte'

/**
 * Applies `viz.mode`: the first value, when it names a real mode. Anything else
 * leaves the persisted mode alone. The environment setter already persists the
 * choice and already defers to plugin registration, so nothing waits here.
 */
export const applyDeepLinkMode = (
	values: readonly string[],
	environment: EnvironmentContext
): void => {
	const value = values[0]
	if (value === undefined || !isEnvironmentMode(value)) return

	environment.current.mode = value
}

/** Core's own consumer of `viz.mode`. Mounted once by `App.svelte`. */
export const useDeepLinkMode = (): void => {
	const environment = useEnvironment()
	useDeepLinkParam('mode', (values) => applyDeepLinkMode(values, environment))
}
