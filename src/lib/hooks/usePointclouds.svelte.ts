import { createQueries, queryOptions, type CreateQueryOptions } from '@tanstack/svelte-query'
import { CameraClient } from '@viamrobotics/sdk'
import { setContext, getContext } from 'svelte'
import { fromStore, toStore } from 'svelte/store'
import { createResourceClient, useResourceNames } from '@viamrobotics/svelte-sdk'
import { parsePcdInWorker } from '$lib/loaders/pcd'
import { RefreshRates, useMachineSettings } from './useMachineSettings.svelte'
import { WorldObject, type PointsGeometry } from '$lib/WorldObject.svelte'
import { usePersistentUUIDs } from './usePersistentUUIDs.svelte'
import { useLogs } from './useLogs.svelte'
import { RefetchRates } from '$lib/components/RefreshRate.svelte'

const key = Symbol('pointcloud-context')

interface Context {
	current: WorldObject<PointsGeometry>[]
	errors: Error[]
}

export const providePointclouds = (partID: () => string) => {
	const logs = useLogs()
	const { refreshRates, disabledCameras } = useMachineSettings()
	const cameras = useResourceNames(partID, 'camera')

	const clients = $derived(
		cameras.current.map((camera) => createResourceClient(CameraClient, partID, () => camera.name))
	)

	const options = $derived.by(() => {
		const interval = refreshRates.get(RefreshRates.pointclouds)
		const results: CreateQueryOptions<
			WorldObject<PointsGeometry> | null,
			Error,
			WorldObject<PointsGeometry> | null,
			string[]
		>[] = []

		for (const cameraClient of clients) {
			const name = cameraClient.current?.name ?? ''

			const options = queryOptions({
				enabled:
					interval !== RefetchRates.OFF &&
					cameraClient.current !== undefined &&
					disabledCameras.get(name) !== true,
				refetchInterval: interval === RefetchRates.MANUAL ? false : interval,
				queryKey: ['getPointCloud', 'partID', partID(), name],
				queryFn: async (): Promise<WorldObject<PointsGeometry> | null> => {
					if (!cameraClient.current) {
						throw new Error('No camera client')
					}

					logs.add(`Fetching pointcloud for ${cameraClient.current.name}`)
					const response = await cameraClient.current.getPointCloud()

					if (!response) return null

					const { positions, colors } = await parsePcdInWorker(new Uint8Array(response))

					return new WorldObject(
						`${name}:pointcloud`,
						undefined,
						name,
						{ center: undefined, geometryType: { case: 'points', value: positions } },
						colors ? { colors } : undefined
					)
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

				updateUUIDs(data)

				return {
					data,
					errors,
				}
			},
		})
	)

	setContext<Context>(key, {
		get current() {
			return queries.current.data
		},
		get errors() {
			return queries.current.errors
		},
	})
}

export const usePointClouds = () => {
	return getContext<Context>(key)
}
