import { ArmClient } from '@viamrobotics/sdk'
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
	const options = { refetchInterval: 500 }

	const names = $derived(arms.current.map((arm) => arm.name))

	const clients = $derived(
		arms.current.map((arm) => createResourceClient(ArmClient, partID, () => arm.name))
	)

	const jointPositionsQueries = $derived(
		clients.map(
			(client) =>
				[client.current?.name, createResourceQuery(client, 'getJointPositions', options)] as const
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
