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
import { usePersistentUUIDs } from './usePersistentUUIDs.svelte'

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

	const propertiesQueries = $derived(
		clients.map((client) => createResourceQuery(client, 'getProperties'))
	)

	const enabledClients = $derived(
		clients.filter(
			(_client, index) => propertiesQueries[index].current.data?.objectPointCloudsSupported
		)
	)

	const options = $derived.by(() => {
		const logs = useLogs()
		const interval = refreshRates.get(RefreshRates.pointclouds)

		const results: CreateQueryOptions<WorldObject[], Error, WorldObject[], string[]>[] = []

		for (const client of enabledClients) {
			const options = queryOptions({
				enabled: interval !== -1 && client.current !== undefined,
				refetchInterval: interval === 0 ? false : interval,
				queryKey: ['partID', partID(), client.current?.name, 'getObjectPointClouds'],
				queryFn: async () => {
					if (!client.current) {
						throw new Error('No vision client')
					}

					logs.add(`Fetching pointcloud objects for ${client.current.name}`)

					const objects: WorldObject[] = []
					const responses = await client.current.getObjectPointClouds('')

					if (!responses) {
						return objects
					}

					console.log(responses)

					for (const response of responses) {
						let index1 = 1

						const { positions, colors } = await parsePcdInWorker(
							new Uint8Array(response.pointCloud)
						)

						console.log(response)

						objects.push(
							new WorldObject(
								`${client.current.name} object pointcloud ${index1}`,
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
							let index2 = 1

							for (const geometry of response.geometries?.geometries) {
								objects.push(
									new WorldObject(
										geometry.label
											? geometry.label
											: `${client.current.name} object pointcloud geometry ${index1}-${index2}`,
										geometry.center,
										response.geometries.referenceFrame
											? response.geometries.referenceFrame
											: 'world',
										geometry
									)
								)

								index2 += 1
							}
						}

						index1 += 1
					}

					return objects
				},
			})

			results.push(options)
		}

		return results
	})

	const { updateUUIDs } = usePersistentUUIDs()

	const queries = fromStore(
		createQueries({
			queries: toStore(() => options),
			combine: (results) => {
				const data = results
					.flatMap((result) => result.data)
					.filter((data) => data !== null && data !== undefined)

				updateUUIDs(data)

				return {
					data,
					error: results
						.flatMap((result) => result.error)
						.filter((data) => data !== null && data !== undefined),
				}
			},
		})
	)

	setContext<Context>(key, {
		get current() {
			return queries.current.data
		},
	})
}

export const usePointcloudObjects = () => {
	return getContext<Context>(key)
}
