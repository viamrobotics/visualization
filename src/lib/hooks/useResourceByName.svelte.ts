import type { ResourceName } from '@viamrobotics/sdk'
import { useResourceNames } from '@viamrobotics/svelte-sdk'
import { getContext, setContext } from 'svelte'

const key = Symbol('resource-by-name-context')

interface Context {
	current: Record<string, ResourceName | undefined>
}

export const provideResourceByName = (partID: () => string) => {
	const resourceNames = useResourceNames(partID)
	const resourceByName = $derived.by(() => {
		const results: Record<string, ResourceName> = {}
		for (const resourceName of resourceNames.current) {
			results[resourceName.name] = resourceName
		}

		return results
	})

	setContext<Context>(key, {
		get current() {
			return resourceByName
		},
	})
}

export const useResourceByName = () => {
	return getContext<Context>(key)
}
