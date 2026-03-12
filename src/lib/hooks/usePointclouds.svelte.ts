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
import { RefetchRates } from '$lib/components/overlay/RefreshRate.svelte'
import { traits, useWorld } from '$lib/ecs'
import type { Entity } from 'koota'
import { useEnvironment } from './useEnvironment.svelte'
import { createBufferGeometry, updateBufferGeometry } from '$lib/attribute'

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

	const fetchedPropQueries = $derived(propQueries.every(([, query]) => query.isPending === false))

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
			if (name && query.data?.supportsPcd === false && disabledCameras.get(name) === undefined) {
				disabledCameras.set(name, true)
			}
		}
	})

	const options = $derived({
		enabled: environment.current.viewerMode === 'monitor',
		refetchInterval: interval === RefetchRates.MANUAL ? (false as const) : interval,
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
			untrack(() => {
				$effect(() => {
					if (query.isFetching) {
						logs.add(`Fetching pointcloud for ${name}...`)
					} else if (query.error) {
						logs.add(`Error fetching pointcloud from ${name}: ${query.error.message}`, 'error')
					}
				})
			})
		}
	})

	const entities = new Map<string, Entity>()
	const queryEntityKeys = new Map<string, Set<string>>()

	$effect(() => {
		for (const [name, query] of queries) {
			$effect(() => {
				const { data } = query

				const nextKeys = new Set<string>()

				const cleanup = () => {
					const prevKeys = queryEntityKeys.get(name) ?? new Set<string>()

					// Remove entities no longer present for this specific query
					for (const key of prevKeys) {
						if (!nextKeys.has(key)) {
							entities.get(key)?.destroy()
							entities.delete(key)
						}
					}

					queryEntityKeys.set(name, nextKeys)
				}

				if (!data || data.length === 0) {
					cleanup()
					return
				}

				parsePcdInWorker(data)
					.then(({ positions, colors }) => {
						const existing = entities.get(name)

						if (existing) {
							const geometry = existing.get(traits.BufferGeometry)

							if (geometry) {
								updateBufferGeometry(geometry, positions, colors)
								return
							}
						}

						const geometry = createBufferGeometry(positions, colors)

						const entity = world.spawn(
							traits.Parent(name),
							traits.Name(`${name} pointcloud`),
							traits.BufferGeometry(geometry),
							traits.Points
						)

						entities.set(name, entity)
					})
					.catch((error) => {
						logs.add(error.reason, 'error')
					})
					.finally(() => {
						cleanup()
					})
			})
		}

		// Clean up old entities
		for (const [name, entity] of entities) {
			if (!queryMap[name]?.data) {
				if (world.has(entity)) {
					entity.destroy()
				}

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
