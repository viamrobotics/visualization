import { CameraClient } from '@viamrobotics/sdk'
import { setContext, getContext } from 'svelte'
import {
	createResourceClient,
	createResourceQuery,
	useResourceNames,
} from '@viamrobotics/svelte-sdk'
import { parsePcdInWorker } from '$lib/loaders/pcd'
import { RefreshRates, useMachineSettings } from './useMachineSettings.svelte'
import { WorldObject, type PointsGeometry } from '$lib/WorldObject.svelte'
import { usePersistentUUIDs } from './usePersistentUUIDs.svelte'
import { useLogs } from './useLogs.svelte'
import { RefetchRates } from '$lib/components/RefreshRate.svelte'

const key = Symbol('pointcloud-context')

interface Context {
	current: WorldObject<PointsGeometry>[]
	refetch: () => void
}

export const providePointclouds = (partID: () => string) => {
	const logs = useLogs()
	const { refreshRates, disabledCameras } = useMachineSettings()
	const cameras = useResourceNames(partID, 'camera')

	const clients = $derived(
		cameras.current.map((camera) => createResourceClient(CameraClient, partID, () => camera.name))
	)

	const propQueries = $derived(
		clients.map(
			(client) =>
				[
					client.current?.name,
					createResourceQuery(client, 'getProperties', {
						staleTime: Infinity,
						refetchOnMount: false,
					}),
				] as const
		)
	)

	const fetchedPropQueries = propQueries.every(([, query]) => query.isPending === false)

	const interval = $derived(refreshRates.get(RefreshRates.pointclouds))
	const enabledClients = $derived(
		clients.filter(
			(client) =>
				fetchedPropQueries &&
				client.current?.name &&
				interval !== RefetchRates.OFF &&
				disabledCameras.get(client.current?.name) !== true
		)
	)

	/**
	 * Disable cameras that don't support pointclouds by default,
	 * but allow users to manually enable afterwards
	 */
	$effect(() => {
		for (const [name, query] of propQueries) {
			if (name && query.data?.supportsPcd === false) {
				if (disabledCameras.get(name) === undefined) {
					disabledCameras.set(name, true)
				}
			}
		}
	})

	const queries = $derived(
		enabledClients.map(
			(client) =>
				[
					client.current?.name,
					createResourceQuery(client, 'getPointCloud', () => ({ refetchInterval: interval })),
				] as const
		)
	)

	const { updateUUIDs } = usePersistentUUIDs()

	let current = $state.raw<WorldObject<PointsGeometry>[]>([])

	$effect(() => {
		for (const [name, query] of queries) {
			if (query.isFetching) {
				logs.add(`Fetching pointcloud for ${name}...`)
			} else if (query.error) {
				logs.add(`Error fetching pointcloud from ${name}: ${query.error.message}`, 'error')
			}
		}
	})

	$effect(() => {
		const binaries: [string, Uint8Array][] = []

		for (const [name, query] of queries) {
			const { data } = query
			if (name && data) {
				binaries.push([name, data])
			}
		}

		Promise.allSettled(
			binaries.map(async ([name, uint8array]) => {
				const { positions, colors } = await parsePcdInWorker(new Uint8Array(uint8array))

				return new WorldObject(
					`${name}:pointcloud`,
					undefined,
					name,
					{ center: undefined, geometryType: { case: 'points', value: positions } },
					colors ? { colors } : undefined
				)
			})
		).then((results) => {
			const worldObjects: WorldObject<PointsGeometry>[] = []
			for (const result of results) {
				if (result.status === 'fulfilled') {
					worldObjects.push(result.value)
				} else if (result.status === 'rejected') {
					logs.add(result.reason, 'error')
				}
			}

			updateUUIDs(worldObjects)
			current = worldObjects
		})
	})

	setContext<Context>(key, {
		get current() {
			return current
		},
		refetch() {
			for (const [, query] of queries) {
				query.refetch()
			}
		},
	})
}

export const usePointClouds = () => {
	return getContext<Context>(key)
}
