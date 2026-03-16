import type { ConfigurableTrait, Entity } from 'koota'

import { VisionClient } from '@viamrobotics/sdk'
import {
	createResourceClient,
	createResourceQuery,
	useResourceNames,
} from '@viamrobotics/svelte-sdk'
import { getContext, setContext, untrack } from 'svelte'

import { createBufferGeometry, updateBufferGeometry } from '$lib/attribute'
import { RefetchRates } from '$lib/components/overlay/RefreshRate.svelte'
import { traits, useWorld } from '$lib/ecs'
import { updateGeometryTrait } from '$lib/ecs/traits'
import { parsePcdInWorker } from '$lib/lib'
import { createPose } from '$lib/transform'

import { useEnvironment } from './useEnvironment.svelte'
import { useLogs } from './useLogs.svelte'
import { RefreshRates, useMachineSettings } from './useMachineSettings.svelte'

const key = Symbol('pointcloud-object-context')

interface Context {
	refetch: () => void
}

export const providePointcloudObjects = (partID: () => string) => {
	const world = useWorld()
	const environment = useEnvironment()
	const { refreshRates, disabledVisionServices } = useMachineSettings()
	const services = useResourceNames(partID, 'vision')

	const clients = $derived(
		services.current.map((service) =>
			createResourceClient(VisionClient, partID, () => service.name)
		)
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

	const enabledClients = $derived.by(() => {
		const results = []

		for (const client of clients) {
			if (
				environment.current.viewerMode === 'monitor' &&
				fetchedPropQueries &&
				client.current?.name &&
				interval !== RefetchRates.OFF &&
				disabledVisionServices.get(client.current?.name) !== true
			) {
				results.push(client as { current: VisionClient })
			}
		}

		return results
	})

	/**
	 * Some machines have a lot of vision services, so before enabling all of them
	 * we'll first check pointcloud object support.
	 *
	 * We'll disable cameras that don't support pointclouds,
	 * but still allow users to manually enable if they want to.
	 */
	$effect(() => {
		for (const [name, query] of propQueries) {
			if (
				name &&
				query.data?.objectPointCloudsSupported === false &&
				disabledVisionServices.get(name) === undefined
			) {
				disabledVisionServices.set(name, true)
			}
		}
	})

	const logs = useLogs()
	const interval = $derived(refreshRates.get(RefreshRates.pointclouds))

	const options = $derived({
		enabled: interval !== RefetchRates.OFF,
		refetchInterval: (interval === RefetchRates.MANUAL ? false : interval) as number | false,
	})

	const queries = $derived(
		enabledClients.map(
			(client) =>
				[
					client.current.name,
					createResourceQuery(client, 'getObjectPointClouds', [''], () => options),
				] as const
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
	const queryEntityKeys = new Map<string, Set<string>>()

	const destroyEntity = (key: string) => {
		const entity = entities.get(key)
		if (entity) {
			if (world.has(entity)) entity.destroy()
			entities.delete(key)
		}
	}

	$effect(() => {
		const currentPartID = partID()
		const activeQueryKeys = new Set<string>()

		for (const [name, query] of queries) {
			const queryKey = `${currentPartID}:${name}`
			activeQueryKeys.add(queryKey)

			$effect(() => {
				const { data } = query

				let disposed = false
				const nextKeys = new Set<string>()

				const reconcileRemovedKeys = () => {
					const prevKeys = queryEntityKeys.get(queryKey) ?? new Set<string>()

					for (const key of prevKeys) {
						if (!nextKeys.has(key)) {
							destroyEntity(key)
						}
					}

					queryEntityKeys.set(queryKey, new Set(nextKeys))
				}

				if (!data || data.length === 0) {
					reconcileRemovedKeys()

					return () => {
						disposed = true
					}
				}

				let index = 0

				for (const { geometries: geometriesInFrame, pointCloud } of data) {
					if (pointCloud.length > 0) {
						const pointcloudLabel = `${name} pointcloud ${index + 1}`
						nextKeys.add(pointcloudLabel)

						parsePcdInWorker(pointCloud)
							.then(({ positions, colors }) => {
								if (disposed) {
									return
								}

								if (!nextKeys.has(pointcloudLabel)) {
									return
								}

								const existing = entities.get(pointcloudLabel)

								if (existing) {
									const geometry = existing.get(traits.BufferGeometry)

									if (geometry) {
										updateBufferGeometry(geometry, positions, colors)
									}
								} else {
									const geometry = createBufferGeometry(positions, colors)

									const entity = world.spawn(
										traits.Name(pointcloudLabel),
										traits.BufferGeometry(geometry),
										traits.Points
									)

									entities.set(pointcloudLabel, entity)
								}
							})
							.catch((error) => {
								if (disposed) {
									return
								}

								logs.add(error?.reason ?? error?.message ?? 'Failed to parse pointcloud', 'error')
							})
					}

					if (geometriesInFrame) {
						let geometryIndex = 0

						for (const geometry of geometriesInFrame.geometries) {
							const geometryLabel = `${name} pointcloud ${index + 1} geometry ${geometryIndex + 1}`

							nextKeys.add(geometryLabel)

							const center = createPose(geometry.center)
							const existing = entities.get(geometryLabel)

							if (existing) {
								existing.set(traits.Center, center)
								updateGeometryTrait(existing, geometry)
							} else {
								const entityTraits: ConfigurableTrait[] = [
									traits.Name(geometryLabel),
									traits.Center(center),
									traits.GeometriesAPI,
									traits.Geometry(geometry),
									traits.Opacity(0.2),
									traits.Color({ r: 0, g: 1, b: 0 }),
								]

								if (geometriesInFrame.referenceFrame) {
									entityTraits.push(traits.Parent(geometriesInFrame.referenceFrame))
								}

								const entity = world.spawn(...entityTraits)

								entities.set(geometryLabel, entity)
							}

							geometryIndex += 1
						}
					}

					index += 1
				}

				reconcileRemovedKeys()

				return () => {
					disposed = true
				}
			})
		}

		// cleanup queries that disappeared entirely
		for (const [queryKey, keys] of queryEntityKeys) {
			if (!activeQueryKeys.has(queryKey)) {
				for (const key of keys) {
					destroyEntity(key)
				}
				queryEntityKeys.delete(queryKey)
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

export const usePointcloudObjects = () => {
	return getContext<Context>(key)
}
