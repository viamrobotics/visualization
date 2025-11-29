import { ArmClient, CameraClient, GantryClient, GripperClient } from '@viamrobotics/sdk'
import {
	createResourceClient,
	createResourceQuery,
	useResourceNames,
} from '@viamrobotics/svelte-sdk'
import { setContext, getContext } from 'svelte'
import { useMachineSettings, RefreshRates } from './useMachineSettings.svelte'
import { WorldObject } from '$lib/WorldObject.svelte'
import { usePersistentUUIDs } from './usePersistentUUIDs.svelte'
import { useLogs } from './useLogs.svelte'
import { resourceColors } from '$lib/color'
import { Color } from 'three'
import { RefetchRates } from '$lib/components/RefreshRate.svelte'
import { useResourceByName } from './useResourceByName.svelte'

const key = Symbol('geometries-context')

interface Context {
	current: WorldObject[]
	refetch: () => void
}

export const provideGeometries = (partID: () => string) => {
	const logs = useLogs()
	const resourceByName = useResourceByName()
	const arms = useResourceNames(partID, 'arm')
	const cameras = useResourceNames(partID, 'camera')
	const grippers = useResourceNames(partID, 'gripper')
	const gantries = useResourceNames(partID, 'gantry')

	const { refreshRates } = useMachineSettings()

	const armClients = $derived(
		arms.current.map((arm) => createResourceClient(ArmClient, partID, () => arm.name))
	)
	const gripperClients = $derived(
		grippers.current.map((gripper) =>
			createResourceClient(GripperClient, partID, () => gripper.name)
		)
	)
	const cameraClients = $derived(
		cameras.current.map((camera) => createResourceClient(CameraClient, partID, () => camera.name))
	)
	const gantryClients = $derived(
		gantries.current.map((gantry) => createResourceClient(GantryClient, partID, () => gantry.name))
	)

	const options = $derived.by(() => {
		const interval = refreshRates.get(RefreshRates.poses)
		return {
			enabled: refreshRates.get(RefreshRates.poses) !== RefetchRates.OFF,
			refetchInterval: interval === RefetchRates.MANUAL ? (false as const) : interval,
		}
	})

	const armQueries = $derived(
		armClients.map(
			(client) =>
				[client.current?.name, createResourceQuery(client, 'getGeometries', () => options)] as const
		)
	)
	const gripperQueries = $derived(
		gripperClients.map(
			(client) =>
				[client.current?.name, createResourceQuery(client, 'getGeometries', () => options)] as const
		)
	)
	const cameraQueries = $derived(
		cameraClients.map(
			(client) =>
				[client.current?.name, createResourceQuery(client, 'getGeometries', () => options)] as const
		)
	)
	const gantryQueries = $derived(
		gantryClients.map(
			(client) =>
				[client.current?.name, createResourceQuery(client, 'getGeometries', () => options)] as const
		)
	)

	$effect(() => {
		for (const [name, query] of queries) {
			if (query.isFetching) {
				logs.add(`Fetching geometries for ${name}...`)
			} else if (query.error) {
				logs.add(`Error fetching geometries from ${name}: ${query.error.message}`, 'error')
			}
		}
	})

	const { updateUUIDs } = usePersistentUUIDs()
	const queries = $derived([...armQueries, ...gripperQueries, ...cameraQueries, ...gantryQueries])

	const geometries = $derived.by(() => {
		const results: WorldObject[] = []

		for (const [name, query] of queries) {
			if (!name || !query.data) {
				continue
			}

			for (const geometry of query.data) {
				const resourceName = resourceByName.current[name]
				const worldObject = new WorldObject(
					geometry.label ? geometry.label : `${name} geometry`,
					undefined,
					name,
					geometry,
					resourceName
						? {
								color: new Color(
									resourceColors[resourceName.subtype as keyof typeof resourceColors]
								),
							}
						: undefined
				)
				results.push(worldObject)
			}
		}

		updateUUIDs(results)

		return results
	})

	setContext<Context>(key, {
		get current() {
			return geometries
		},
		refetch() {
			for (const [, query] of queries) {
				query.refetch()
			}
		},
	})
}

export const useGeometries = () => {
	return getContext<Context>(key)
}
