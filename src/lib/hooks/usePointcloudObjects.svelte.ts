import { VisionClient } from '@viamrobotics/sdk'
import {
	createResourceClient,
	createResourceQuery,
	useResourceNames,
} from '@viamrobotics/svelte-sdk'
import { RefreshRates, useMachineSettings } from './useMachineSettings.svelte'
import { useLogs } from './useLogs.svelte'
import { parsePcdInWorker } from '$lib/lib'
import { getContext, setContext, untrack } from 'svelte'
import { traits, useWorld } from '$lib/ecs'
import type { Entity, ConfigurableTrait } from 'koota'
import { createBufferGeometry, updateBufferGeometry } from '$lib/attribute'
import { useEnvironment } from './useEnvironment.svelte'
import { RefetchRates } from '$lib/components/overlay/RefreshRate.svelte'
import { createPose } from '$lib/transform'

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
		enabled: interval !== -1,
		refetchInterval: (interval === 0 ? false : interval) as number | false,
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
	const queryVersions = new Map<string, number>()

	$effect(() => {
		for (const [name, query] of queries) {
			$effect(() => {
				const { data } = query

				const version = (queryVersions.get(name) ?? 0) + 1
				queryVersions.set(name, version)

				let disposed = false
				const nextKeys = new Set<string>()

				const destroyEntity = (key: string) => {
					const entity = entities.get(key)
					if (entity) {
						if (world.has(entity)) entity.destroy()
						entities.delete(key)
					}
				}

				const reconcileRemovedKeys = () => {
					const prevKeys = queryEntityKeys.get(name) ?? new Set<string>()

					for (const key of prevKeys) {
						if (!nextKeys.has(key)) {
							destroyEntity(key)
						}
					}

					queryEntityKeys.set(name, new Set(nextKeys))
				}

				if (!data || data.length === 0) {
					reconcileRemovedKeys()

					return () => {
						disposed = true
						if (queryVersions.get(name) === version) {
							queryVersions.set(name, version + 1)
						}
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

								if (queryVersions.get(name) !== version) {
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

								if (queryVersions.get(name) !== version) {
									return
								}

								logs.add(error.reason, 'error')
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

					if (queryVersions.get(name) === version) {
						queryVersions.set(name, version + 1)
					}
				}
			})
		}

		return () => {
			for (const [, entity] of entities) {
				if (world.has(entity)) entity.destroy()
			}
			entities.clear()
			queryEntityKeys.clear()
			queryVersions.clear()
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
