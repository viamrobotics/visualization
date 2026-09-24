import { ArmClient } from '@viamrobotics/sdk'
import {
	createResourceClient,
	createResourceQuery,
	useResourceStatuses,
} from '@viamrobotics/svelte-sdk'
import { getContext, setContext } from 'svelte'

const key = Symbol('arm-client-context')

interface Context {
	names: string[]
	currentPositions: Record<string, number[] | undefined>
}

export const provideArmClient = (partID: () => string) => {
	const arms = useResourceStatuses(partID, 'arm')
	const options = { refetchInterval: 500 }

	const names = $derived(
		arms.current.map((arm) => arm.name?.name).filter((name): name is string => name !== undefined)
	)

	const clients = $derived(names.map((name) => createResourceClient(ArmClient, partID, () => name)))

	const jointPositionsQueries = $derived(
		clients.map(
			(client) => [client.name, createResourceQuery(client, 'getJointPositions', options)] as const
		)
	)

	const currentPositions = $derived(
		Object.fromEntries(jointPositionsQueries.map(([name, query]) => [name, query.data?.values]))
	)

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
