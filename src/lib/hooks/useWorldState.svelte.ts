import { useResourceStatuses } from '@viamrobotics/svelte-sdk'
import { getContext, setContext } from 'svelte'

import { provideWorldStateStreamStats } from './worldStateStreamStats'

const key = Symbol('world-state-context')

interface Context {
	/** The world-state store services on the current part. */
	readonly stores: string[]
}

export const provideWorldStates = (partID: () => string) => {
	provideWorldStateStreamStats()
	const statuses = useResourceStatuses(partID, 'world_state_store')

	const stores = $derived(
		statuses.current
			.map((status) => status.name?.name)
			.filter((name): name is string => name !== undefined)
	)

	setContext<Context>(key, {
		get stores() {
			return stores
		},
	})
}

export const useWorldStates = () => {
	return getContext<Context>(key)
}
