import { createQueries, queryOptions, type CreateQueryOptions } from '@tanstack/svelte-query'
import { CameraClient } from '@viamrobotics/sdk'
import { setContext, getContext } from 'svelte'
import { fromStore, toStore } from 'svelte/store'
import { createResourceClient, useResourceNames } from '@viamrobotics/svelte-sdk'
import { parsePcdInWorker } from '$lib/loaders/pcd'
import { useMachineSettings } from './useMachineSettings.svelte'
import { WorldObject, type PointsGeometry } from '$lib/WorldObject.svelte'
import { usePersistentUUIDs } from './usePersistentUUIDs.svelte'
import { useLogs } from './useLogs.svelte'

const key = Symbol('pointcloud-context')

interface Context {
	current: WorldObject<PointsGeometry>[]
}

export const providePointclouds = (partID: () => string) => {
	const logs = useLogs()
	const { refreshRates, disabledCameras } = useMachineSettings()
	const cameras = useResourceNames(partID, 'camera')

	if (!refreshRates.has('Pointclouds')) {
		refreshRates.set('Pointclouds', -1)
	}

	const clients = $derived(
		cameras.current.map((camera) => createResourceClient(CameraClient, partID, () => camera.name))
	)

	const options = $derived.by(() => {
		const interval = refreshRates.get('Pointclouds')
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
					interval !== -1 &&
					cameraClient.current !== undefined &&
					disabledCameras.get(name) !== true,
				refetchInterval: interval === 0 ? false : interval,
				queryKey: ['partID', partID(), name, 'getPointCloud'],
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
						{ case: 'points', value: positions },
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

				updateUUIDs(data)

				return {
					data,
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

export const usePointClouds = () => {
	return getContext<Context>(key)
}
