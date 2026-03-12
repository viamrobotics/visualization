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
	const versions = new Map<string, number>()

	$effect(() => {
		for (const [name, query] of queries) {
			$effect(() => {
				const { data } = query

				const version = (versions.get(name) ?? 0) + 1
				versions.set(name, version)

				let disposed = false

				const destroyEntity = () => {
					const entity = entities.get(name)
					if (entity) {
						if (world.has(entity)) entity.destroy()
						entities.delete(name)
					}
				}

				if (!data || data.length === 0) {
					destroyEntity()
					return () => {
						disposed = true
					}
				}

				parsePcdInWorker(data)
					.then(({ positions, colors }) => {
						if (disposed) {
							return
						}

						if (versions.get(name) !== version) {
							return
						}

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
						if (disposed) {
							return
						}

						if (versions.get(name) !== version) {
							return
						}

						logs.add(error.reason, 'error')
					})

				return () => {
					disposed = true

					// invalidate older async work for this name
					if (versions.get(name) === version) {
						versions.set(name, version + 1)
					}
				}
			})
		}

		return () => {
			for (const [, entity] of entities) {
				if (world.has(entity)) entity.destroy()
			}
			entities.clear()
			versions.clear()
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
