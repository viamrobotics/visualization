import { VisionClient } from '@viamrobotics/sdk'
import {
	createResourceClient,
	createResourceQuery,
	useMachineStatus,
	useResourceNames,
} from '@viamrobotics/svelte-sdk'
import { RefreshRates, useMachineSettings } from './useMachineSettings.svelte'
import { createQueries, queryOptions, type CreateQueryOptions } from '@tanstack/svelte-query'
import { WorldObject } from '$lib/WorldObject.svelte'
import { useLogs } from './useLogs.svelte'
import { parsePcdInWorker } from '$lib/lib'
import { fromStore, toStore } from 'svelte/store'
import { getContext, setContext } from 'svelte'

const key = Symbol('pointcloud-object-context')

interface Context {
	current: WorldObject[]
}

export const providePointcloudObjects = (partID: () => string) => {
	const { refreshRates, disabledCameras } = useMachineSettings()
	const services = useResourceNames(partID, 'vision')

	const clients = $derived(
		services.current.map((service) =>
			createResourceClient(VisionClient, partID, () => service.name)
		)
	)

	const options = $derived.by(() => {
		const logs = useLogs()
		const interval = refreshRates.get(RefreshRates.pointclouds)

		const results: CreateQueryOptions<WorldObject[], Error, WorldObject[], string[]>[] = []

		for (const client of clients) {
			const options = queryOptions({
				enabled: interval !== -1 && client.current !== undefined,
				refetchInterval: interval === 0 ? false : interval,
				queryKey: ['partID', partID(), client.current?.name, 'getObjectPointClouds'],
				queryFn: async () => {
					if (!client.current) {
						throw new Error('No camera client')
					}

					const properties = await client.current.getProperties()

					const objects: WorldObject[] = []

					if (!properties.objectPointCloudsSupported) {
						return objects
					}

					logs.add(`Fetching pointcloud for ${client.current.name}`)

					const responses = await client.current.getObjectPointClouds('')

					if (!responses) return objects

					for (const response of responses) {
						const { positions, colors } = await parsePcdInWorker(
							new Uint8Array(response.pointCloud)
						)

						objects.push(
							new WorldObject(
								`${client.current.name} pointcloud`,
								undefined,
								'world',
								{
									center: undefined,
									geometryType: { case: 'points', value: positions },
								},
								colors ? { colors } : undefined
							)
						)

						if (response.geometries?.geometries) {
							for (const geometry of response.geometries?.geometries) {
								objects.push(
									new WorldObject(
										geometry.label,
										geometry.center,
										response.geometries.referenceFrame,
										geometry
									)
								)
							}
						}
					}

					return objects
				},
			})

			results.push(options)
		}

		return results
	})

	const queries = fromStore(
		createQueries({
			queries: toStore(() => options),
			combine: (results) => {
				const data = results
					.flatMap((result) => result.data)
					.filter((data) => data !== null && data !== undefined)

				return {
					data,
					error: results
						.flatMap((result) => result.error)
						.filter((data) => data !== null && data !== undefined),
				}
			},
		})
	)

	$inspect(clients, queries.current.error)

	setContext<Context>(key, {
		get current() {
			return queries.current.data
		},
	})
}

export const usePointcloudObjects = () => {
	return getContext<Context>(key)
}
