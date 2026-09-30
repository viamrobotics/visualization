import { useMachineStatus } from '@viamrobotics/svelte-sdk'
import { getContext, setContext } from 'svelte'

import type { UnhealthyResource } from './unhealthyResources'

import { unhealthyResources } from './unhealthyResources'

const key = Symbol('resource-health-context')

export interface Context {
	/** Every resource the machine currently reports as unhealthy. */
	readonly unhealthy: UnhealthyResource[]

	/** The machine's report for one resource, or `undefined` while it is healthy. */
	statusFor: (name: string | undefined) => UnhealthyResource | undefined
}

/**
 * One machine-status query for every consumer that asks after a resource's
 * health. Each world tree row asks after its own, so the status is read once
 * here and answered from a map: `useMachineStatus` per row would mean a query
 * observer and a re-sort of the whole resource list per row.
 */
export const provideResourceHealth = (partID: () => string): Context => {
	const machineStatus = useMachineStatus(partID)

	const unhealthy = $derived(unhealthyResources(machineStatus.current?.resources))
	const byName = $derived(new Map(unhealthy.map((resource) => [resource.name, resource])))

	const context: Context = {
		get unhealthy() {
			return unhealthy
		},
		statusFor: (name) => (name === undefined ? undefined : byName.get(name)),
	}

	setContext(key, context)

	return context
}

export const useResourceHealth = (): Context => getContext(key)
