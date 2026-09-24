import type { ResourceName } from '@viamrobotics/sdk'

import { useResourceStatuses } from '@viamrobotics/svelte-sdk'
import { getContext, setContext } from 'svelte'

const RESOURCE_BY_NAME_CONTEXT_KEY = Symbol('resource-by-name-context')

interface Context {
	current: Record<string, ResourceName | undefined>
}

const createResourceByName = (partID: () => string) => {
	const statuses = useResourceStatuses(partID)
	const resourceByName = $derived.by(() => {
		const results: Record<string, ResourceName> = {}
		for (const { name } of statuses.current) {
			if (name) results[name.name] = name
		}

		return results
	})

	return {
		get current() {
			return resourceByName
		},
	}
}

export const provideResourceByName = (partID: () => string) => {
	setContext<Context>(RESOURCE_BY_NAME_CONTEXT_KEY, createResourceByName(partID))
}

export const useResourceByName = () => {
	return getContext<Context>(RESOURCE_BY_NAME_CONTEXT_KEY)
}
