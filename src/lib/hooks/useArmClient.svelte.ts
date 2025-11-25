import type { QueryObserverResult } from '@tanstack/svelte-query'
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
	const options = { refetchInterval: 500 }

	const names = $derived(arms.current.map((arm) => arm.name))

	const clients = $derived(
		arms.current.map((arm) => createResourceClient(ArmClient, partID, () => arm.name))
	)

	const jointPositionsQueries = $derived.by(() => {
		const results: Record<string, QueryObserverResult<ArmJointPositions, Error>> = {}

		for (const client of clients) {
			if (!client.current) continue

			const query = createResourceQuery(client, 'getJointPositions', options)
			results[client.current.name] = query
		}

		return results
	})

	const currentPositions = $derived(
		Object.fromEntries(
			Object.entries(jointPositionsQueries).map(([name, query]) => [name, query.data?.values])
		)
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
