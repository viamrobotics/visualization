import { ArmClient } from '@viamrobotics/sdk'
import {
	createResourceClient,
	createResourceQuery,
	useResourceNames,
} from '@viamrobotics/svelte-sdk'
import { getContext, setContext } from 'svelte'

const key = Symbol('arm-kinematics-context')

export interface JointLimit {
	id: string
	min: number
	max: number
}

interface Context {
	names: string[]
	kinematics: Record<string, JointLimit[] | undefined>
}

export const provideArmKinematics = (partID: () => string) => {
	const arms = useResourceNames(partID, 'arm')
	// Kinematics are static config data, so fetch once and cache indefinitely
	const options = { staleTime: Infinity, refetchOnMount: false, refetchInterval: false as const }

	const names = $derived(arms.current.map((arm) => arm.name))

	const clients = $derived(
		arms.current.map((arm) => createResourceClient(ArmClient, partID, () => arm.name))
	)

	const kinematicsQueries = $derived(
		clients.map(
			(client) =>
				[client.current?.name, createResourceQuery(client, 'getKinematics', () => options)] as const
		)
	)

	const kinematics = $derived(
		Object.fromEntries(
			kinematicsQueries.map(([name, query]) => [
				name,
				query.data?.joints.map((j) => ({
					id: j.id,
					min: j.min,
					max: j.max,
				})),
			])
		)
	)

	setContext<Context>(key, {
		get names() {
			return names
		},
		get kinematics() {
			return kinematics
		},
	})
}

export const useArmKinematics = (): Context => {
	return getContext<Context>(key)
}
