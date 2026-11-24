import type { Entity } from 'koota'

import { useMachineStatus } from '@viamrobotics/svelte-sdk'
import { getContext, setContext } from 'svelte'

import { setIssues, traits, useQuery } from '#lib/ecs/index.js'
import { useResourceRowRenames } from '#lib/hooks/useResourceRowRenames.svelte.js'

import type { UnhealthyResource } from './unhealthyResources'

import { unhealthyResources } from './unhealthyResources'

const key = Symbol('resource-health-context')

const healthLine = ({ error }: UnhealthyResource): traits.IssueLine => ({
	severity: 'warn',
	message: error
		? `The machine reports this resource as unhealthy: ${error}`
		: 'The machine reports this resource as unhealthy',
})

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

	// A name is not unique across the world: a drawn transform takes its reference frame's
	// name (`#lib/draw.ts`), so only rows that stand for a resource are marked.
	const frameEntities = useQuery(traits.FramesAPI, traits.Name)
	const framelessEntities = useQuery(traits.FramelessComponent, traits.Name)
	const renames = useResourceRowRenames()
	const marked = new Set<Entity>()

	$effect(() => {
		void renames.current
		const resourceEntities = [...frameEntities.current, ...framelessEntities.current]

		for (const entity of marked) {
			if (!resourceEntities.includes(entity)) setIssues(entity, 'health', [])
		}
		marked.clear()

		for (const entity of resourceEntities) {
			const resource = byName.get(entity.get(traits.Name) ?? '')
			setIssues(entity, 'health', resource ? [healthLine(resource)] : [])
			if (resource) marked.add(entity)
		}
	})

	$effect(() => {
		return () => {
			for (const entity of marked) setIssues(entity, 'health', [])
			marked.clear()
		}
	})

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
