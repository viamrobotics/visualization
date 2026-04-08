import type { ConfigurableTrait, Entity } from 'koota'

import { CameraClient } from '@viamrobotics/sdk'
import {
	createResourceClient,
	createResourceQuery,
	useResourceNames,
} from '@viamrobotics/svelte-sdk'
import { getContext, setContext, untrack } from 'svelte'

import {
	createBufferGeometry,
	createLODGeometries,
	updateBufferGeometry,
	updateLODGeometries,
} from '$lib/attribute'
import { RefetchRates } from '$lib/components/overlay/RefreshRate.svelte'
import { traits, useWorld } from '$lib/ecs'
import { parsePcdWithLOD } from '$lib/loaders/pcd'

import { useEnvironment } from './useEnvironment.svelte'
import { useLogs } from './useLogs.svelte'
import { RefreshRates, useSettings } from './useSettings.svelte'

const key = Symbol('pointcloud-context')

interface Context {
	refetch: () => void
}

export const providePointclouds = (partID: () => string) => {
	const environment = useEnvironment()
	const world = useWorld()
	const logs = useLogs()
	const settings = useSettings()
	const { refreshRates, disabledCameras } = $derived(settings.current)
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

	const interval = $derived(refreshRates[RefreshRates.pointclouds])
	const enabledClients = $derived.by(() => {
		const results = []

		for (const client of clients) {
			if (
				fetchedPropQueries &&
				client.current?.name &&
				interval !== RefetchRates.OFF &&
				disabledCameras[client.current?.name] !== true
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
			if (name && query.data?.supportsPcd === false && disabledCameras[name] === undefined) {
				disabledCameras[name] = true
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

	$effect(() => {
		const currentPartID = partID()
		const activeQueryKeys = new Set<string>()

		for (const [name, query] of queries) {
			const queryKey = `${currentPartID}:${name}`
			activeQueryKeys.add(queryKey)

			$effect(() => {
				const { data } = query

				let disposed = false

				const destroyEntity = () => {
					const entity = entities.get(queryKey)
					if (entity) {
						if (world.has(entity)) entity.destroy()
						entities.delete(queryKey)
					}
				}

				if (!data || data.length === 0) {
					destroyEntity()
					return () => {
						disposed = true
					}
				}

				parsePcdWithLOD(data)
					.then(({ levels, boundingBoxDiagonal }) => {
						if (disposed) {
							return
						}

						const existing = entities.get(queryKey)
						const finest = levels.find((l) => l.level === 0) ?? levels[0]!

						if (existing) {
							const geometry = existing.get(traits.BufferGeometry)
							const existingLOD = existing.get(traits.PointCloudLOD)

							if (geometry) {
								updateBufferGeometry(geometry, finest.positions, finest.colors)
							}

							if (existingLOD && levels.length > 1) {
								// Update geometry buffers in place without setting the trait
								// to avoid triggering re-renders and component remounts.
								// BVH is not recomputed here — it drifts slightly between
								// frames but avoids expensive main-thread recomputation.
								updateLODGeometries(existingLOD.levels, levels)
							}

							return
						}

						const geometry = createBufferGeometry(finest.positions, finest.colors)

						const entityTraits: ConfigurableTrait[] = [
							traits.Parent(name),
							traits.Name(`${name} pointcloud`),
							traits.BufferGeometry(geometry),
							traits.Points,
						]

						if (levels.length > 1) {
							entityTraits.push(
								traits.PointCloudLOD({
									levels: createLODGeometries(levels),
									diagonal: boundingBoxDiagonal,
								})
							)
						}

						const entity = world.spawn(...entityTraits)
						entities.set(queryKey, entity)
					})
					.catch((error) => {
						if (disposed) {
							return
						}

						logs.add(error?.reason ?? error?.message ?? 'Failed to parse pointcloud', 'error')
					})

				return () => {
					disposed = true
				}
			})
		}

		// clean up queries that disappeared entirely
		for (const [queryKey, entity] of entities) {
			if (!activeQueryKeys.has(queryKey)) {
				if (world.has(entity)) {
					entity.destroy()
				}
				entities.delete(queryKey)
			}
		}
	})

	$effect(() => {
		return () => {
			for (const [, entity] of entities) {
				entity.destroy()
			}

			entities.clear()
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
