import { createQueries, queryOptions, type CreateQueryOptions } from '@tanstack/svelte-query'
import { CameraClient } from '@viamrobotics/sdk'
import { setContext, getContext } from 'svelte'
import { fromStore, toStore } from 'svelte/store'
import { createResourceClient, useResourceNames } from '@viamrobotics/svelte-sdk'
import { parsePcdInWorker } from '$lib/loaders/pcd'
import { RefreshRates, useMachineSettings } from './useMachineSettings.svelte'
import { usePersistentUUIDs } from './usePersistentUUIDs.svelte'
import { useLogs } from './useLogs.svelte'
import { RefetchRates } from '$lib/components/RefreshRate.svelte'
import { traits, useWorld } from '$lib/ecs'
import type { Entity } from 'koota'

const key = Symbol('pointcloud-context')

interface Context {
	errors: Error[]
}

interface QueryResult {
	name: string
	positions: Float32Array<ArrayBuffer>
	colors: Float32Array<ArrayBuffer> | null
}

export const providePointclouds = (partID: () => string) => {
	const world = useWorld()
	const logs = useLogs()
	const { refreshRates, disabledCameras } = useMachineSettings()
	const cameras = useResourceNames(partID, 'camera')

	const clients = $derived(
		cameras.current.map((camera) => createResourceClient(CameraClient, partID, () => camera.name))
	)

	const options = $derived.by(() => {
		const interval = refreshRates.get(RefreshRates.pointclouds)

		const results: CreateQueryOptions<QueryResult | null, Error, QueryResult | null, string[]>[] =
			[]

		for (const cameraClient of clients) {
			const name = cameraClient.current?.name ?? ''

			const options = queryOptions({
				enabled:
					interval !== RefetchRates.OFF &&
					cameraClient.current !== undefined &&
					disabledCameras.get(name) !== true,
				refetchInterval: interval === RefetchRates.MANUAL ? false : interval,
				queryKey: ['getPointCloud', 'partID', partID(), name],
				queryFn: async (): Promise<QueryResult | null> => {
					if (!cameraClient.current) {
						throw new Error('No camera client')
					}

					logs.add(`Fetching pointcloud for ${cameraClient.current.name}`)
					const response = await cameraClient.current.getPointCloud()

					if (!response) return null

					const { positions, colors } = await parsePcdInWorker(new Uint8Array(response))

					return {
						name,
						positions,
						colors,
					}
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

				const errors = results.flatMap((result) => result.error).filter((error) => error !== null)

				return {
					data,
					errors,
				}
			},
		})
	)

	$effect(() => {
		const entities: Entity[] = []
		for (const { name, positions, colors } of queries.current.data) {
			const entity = world.spawn(
				traits.UUID,
				traits.Name(`${name} pointcloud`),
				traits.Parent(name),
				traits.PointsGeometry(positions),
				colors ? traits.VertexColors(colors) : traits.Color
			)

			entities.push(entity)
		}

		updateUUIDs(entities)

		return () => {
			for (const entity of entities) {
				entity.destroy()
			}
		}
	})

	setContext<Context>(key, {
		get errors() {
			return queries.current.errors
		},
	})
}

export const usePointClouds = () => {
	return getContext<Context>(key)
}
