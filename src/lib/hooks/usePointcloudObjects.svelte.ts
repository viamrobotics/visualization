import { GeometriesInFrame, PointCloudObject, VisionClient } from '@viamrobotics/sdk'
import {
	createResourceClient,
	createResourceQuery,
	useResourceNames,
} from '@viamrobotics/svelte-sdk'
import { RefreshRates, useMachineSettings } from './useMachineSettings.svelte'
import { useLogs } from './useLogs.svelte'
import { parsePcdInWorker } from '$lib/lib'
import { getContext, setContext } from 'svelte'
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
			if (name && query.data?.objectPointCloudsSupported === false) {
				if (disabledVisionServices.get(name) === undefined) {
					disabledVisionServices.set(name, true)
				}
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
			if (query.isFetching) {
				logs.add(`Fetching pointcloud for ${name}...`)
			} else if (query.error) {
				logs.add(`Error fetching pointcloud from ${name}: ${query.error.message}`, 'error')
			}
		}
	})

	interface PCResult {
		name: string
		pointclouds: {
			positions: Float32Array
			colors?: Uint8Array | null
		}[]
		geometries: (GeometriesInFrame | undefined)[]
	}

	let pcResults = $state.raw<PCResult[]>([])

	$effect(() => {
		const responses: [string, PointCloudObject[]][] = []

		for (const [name, query] of queries) {
			const { data } = query
			if (name && data) {
				responses.push([name, data])
			}
		}

		Promise.allSettled(
			responses.map(async ([name, pointcloudObjects]) => {
				const pointclouds = await Promise.all(
					pointcloudObjects
						.filter((value) => value !== undefined)
						.map((value) => {
							return parsePcdInWorker(new Uint8Array(value.pointCloud))
						})
				)

				return {
					name,
					pointclouds,
					geometries: pointcloudObjects.map((value) => value.geometries),
				}
			})
		).then((results) => {
			const fulfilledResults: PCResult[] = []

			for (const result of results) {
				if (result.status === 'fulfilled') {
					fulfilledResults.push(result.value)
				} else if (result.status === 'rejected') {
					logs.add(result.reason, 'error')
				}
			}

			pcResults = fulfilledResults
		})
	})

	const entities = new Map<string, Entity>()

	$effect(() => {
		const active: Record<string, boolean> = {}

		for (const { name, pointclouds, geometries } of pcResults) {
			for (const [pointcloudIndex, pointcloud] of pointclouds.entries()) {
				const poincloudLabel = `${name} pointcloud ${pointcloudIndex + 1}`
				const existing = entities.get(poincloudLabel)

				active[poincloudLabel] = true

				if (existing) {
					const geometry = existing.get(traits.BufferGeometry)

					if (geometry) {
						updateBufferGeometry(geometry, pointcloud.positions, pointcloud.colors)
					}
				} else {
					const geometry = createBufferGeometry(pointcloud.positions, pointcloud.colors)

					const entity = world.spawn(
						traits.Name(poincloudLabel),
						traits.BufferGeometry(geometry),
						traits.Points
					)

					entities.set(poincloudLabel, entity)
				}

				if (geometries) {
					for (const geometriesInFrame of geometries) {
						if (geometriesInFrame) {
							for (const [geometryIndex, geometry] of geometriesInFrame.geometries.entries()) {
								const geometryLabel = `${name} pointcloud ${pointcloudIndex} geometry ${geometryIndex + 1}`
								const pose = createPose(geometry.center)

								active[geometryLabel] = true

								const existing = entities.get(geometryLabel)

								if (existing) {
									existing.set(traits.Pose, pose)
								} else {
									const entityTraits: ConfigurableTrait[] = [
										traits.Name(geometryLabel),
										traits.Pose(pose),
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
							}
						}
					}
				}
			}
		}

		// Clean up old entities
		for (const [label, entity] of entities) {
			if (!active[label]) {
				if (world.has(entity)) {
					entity.destroy()
				}
				entities.delete(label)
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
