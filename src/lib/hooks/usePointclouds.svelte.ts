import { CameraClient } from '@viamrobotics/sdk'
import { setContext, getContext, untrack } from 'svelte'
import {
	createResourceClient,
	createResourceQuery,
	useResourceNames,
} from '@viamrobotics/svelte-sdk'
import { parsePcdInWorker } from '$lib/loaders/pcd'
import { RefreshRates, useMachineSettings } from './useMachineSettings.svelte'
import { useLogs } from './useLogs.svelte'
import { RefetchRates } from '$lib/components/RefreshRate.svelte'
import { traits, useWorld } from '$lib/ecs'
import type { Entity } from 'koota'
import { useEnvironment } from './useEnvironment.svelte'

const typeSafeObjectFromEntries = <const T extends ReadonlyArray<readonly [PropertyKey, unknown]>>(
	entries: T
): { [K in T[number] as K[0]]: K[1] } => {
	return Object.fromEntries(entries) as { [K in T[number] as K[0]]: K[1] }
}

const key = Symbol('pointcloud-context')

interface Context {
	refetch: () => void
}

export const providePointclouds = (partID: () => string) => {
	const environment = useEnvironment()
	const world = useWorld()
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
						refetchInterval: false,
					}),
				] as const
		)
	)

	const fetchedPropQueries = propQueries.every(([, query]) => query.isPending === false)

	const interval = $derived(refreshRates.get(RefreshRates.pointclouds))
	const enabledClients = $derived.by(() => {
		const results = []

		for (const client of clients) {
			if (
				fetchedPropQueries &&
				client.current?.name &&
				interval !== RefetchRates.OFF &&
				disabledCameras.get(client.current?.name) !== true
			) {
				results.push(client as { current: CameraClient })
			}
		}

		return results
	})

	/**
	 * Some machines have a lot of cameras, so before enabling all of them
	 * we'll first check pointcloud support.
	 *
	 * We'll disable cameras that don't support pointclouds,
	 * but still allow users to manually enable if they want to.
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

	const options = $derived({
		enabled: environment.current.viewerMode === 'edit',
		refetchInterval: interval,
	})

	const queries = $derived(
		enabledClients.map(
			(client) =>
				[client.current.name, createResourceQuery(client, 'getPointCloud', () => options)] as const
		)
	)

	const queryMap = $derived(typeSafeObjectFromEntries(queries))

	$effect(() => {
		for (const [name, query] of queries) {
			if (query.isFetching) {
				logs.add(`Fetching pointcloud for ${name}...`)
			} else if (query.error) {
				logs.add(`Error fetching pointcloud from ${name}: ${query.error.message}`, 'error')
			}
		}
	})

	const pcObjects = $state<
		{
			name: string
			positions: Float32Array<ArrayBuffer>
			colors: Float32Array<ArrayBuffer> | null
		}[]
	>([])

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

				return { name, positions, colors }
			})
		).then((results) => {
			for (const result of results) {
				if (result.status === 'fulfilled') {
					untrack(() => pcObjects.push(result.value))
				} else if (result.status === 'rejected') {
					logs.add(result.reason, 'error')
				}
			}
		})
	})

	const entities = new Map<string, Entity>()

	$effect(() => {
		// Create or update entities
		for (const { name, positions, colors } of pcObjects) {
			const existing = entities.get(name)

			if (existing) {
				existing.set(traits.PointsPositions, positions)

				if (colors) {
					existing.set(traits.VertexColors, colors)
				}

				continue
			}

			const entity = world.spawn(
				traits.Parent(name),
				traits.Name(`${name} pointcloud`),
				traits.PointsPositions(positions),
				colors ? traits.VertexColors(colors) : traits.Color
			)

			entities.set(name, entity)
		}

		// Clean up old entities
		for (const [name, entity] of entities) {
			if (!queryMap[name]?.data) {
				entity.destroy()
				entities.delete(name)
			}
		}
	})

	setContext<Context>(key, {
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
