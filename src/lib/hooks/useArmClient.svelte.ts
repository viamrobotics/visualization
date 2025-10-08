import type { CreateQueryOptions, QueryObserverResult } from '@tanstack/svelte-query'
import { ArmClient, ArmJointPositions } from '@viamrobotics/sdk'
import {
	createResourceClient,
	createResourceQuery,
	useResourceNames,
} from '@viamrobotics/svelte-sdk'
import { getContext, setContext } from 'svelte'

const key = Symbol('arm-client-context')

interface Context {
	names: string[]
	currentPositions: Record<string, number[] | undefined>
}

export const provideArmClient = (partID: () => string) => {
	const arms = useResourceNames(partID, 'arm')
	const clients = $state<Record<string, { current: ArmClient }>>({})
	const options = { refetchInterval: 500 }
	const jointPositionsQueries = $state<
		Record<string, QueryObserverResult<ArmJointPositions, Error>>
	>({})

	const names = $derived(arms.current.map((arm) => arm.name))

	const currentPositions = $derived(
		Object.fromEntries(
			Object.entries(jointPositionsQueries).map(([name, query]) => [name, query.data?.values])
		)
	)

	$effect(() => {
		for (const arm of arms.current) {
			const client = createResourceClient(ArmClient, partID, () => arm.name)
			if (client.current && !clients[arm.name]) clients[arm.name] = { current: client.current }
		}
	})

	$effect(() => {
		for (const client of Object.values(clients)) {
			const query = createResourceQuery(client, 'getJointPositions', options)
			jointPositionsQueries[client.current.name] = query.current
		}
	})

	setContext<Context>(key, {
		get names() {
			return names
		},
		get currentPositions() {
			return currentPositions
		},
	})
}

export const useArmClient = (): Context => {
	return getContext<Context>(key)
}
