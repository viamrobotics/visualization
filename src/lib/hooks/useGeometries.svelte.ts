import { ArmClient, CameraClient, GantryClient, Geometry, GripperClient } from '@viamrobotics/sdk'
import { createQueries, queryOptions, type CreateQueryOptions } from '@tanstack/svelte-query'
import { createResourceClient, useResourceNames } from '@viamrobotics/svelte-sdk'
import { setContext, getContext } from 'svelte'
import { fromStore, toStore } from 'svelte/store'
import { useMachineSettings, RefreshRates } from './useMachineSettings.svelte'
import { WorldObject, type Metadata } from '$lib/WorldObject.svelte'
import { usePersistentUUIDs } from './usePersistentUUIDs.svelte'
import { useLogs } from './useLogs.svelte'
import { resourceColors } from '$lib/color'
import { Color } from 'three'
import { useFrames } from './useFrames.svelte'

const key = Symbol('geometries-context')

interface Context {
	current: WorldObject[]
	componentModels: Record<string, Record<string, Geometry>>
	errors: Error[]
}

export const provideGeometries = (partID: () => string) => {
	const frames = useFrames()
	const resourceNames = useResourceNames(partID)
	const arms = useResourceNames(partID, 'arm')
	const cameras = useResourceNames(partID, 'camera')
	const grippers = useResourceNames(partID, 'gripper')
	const gantries = useResourceNames(partID, 'gantry')

	const componentModels = $state.raw<Record<string, Record<string, Geometry>>>({})

	const logs = useLogs()
	const { refreshRates } = useMachineSettings()

	const armClients = $derived(
		arms.current.map((arm) => createResourceClient(ArmClient, partID, () => arm.name))
	)
	const gripperClients = $derived(
		grippers.current.map((gripper) =>
			createResourceClient(GripperClient, partID, () => gripper.name)
		)
	)
	const cameraClients = $derived(
		cameras.current.map((camera) => createResourceClient(CameraClient, partID, () => camera.name))
	)
	const gantryClients = $derived(
		gantries.current.map((gantry) => createResourceClient(GantryClient, partID, () => gantry.name))
	)

	const clients = $derived(
		[...armClients, ...gripperClients, ...cameraClients, ...gantryClients].filter((client) => {
			return frames.current.some((frame) => frame.name === client.current?.name)
		})
	)

	$effect(() => {
		const fetchArmModels = async () => {
			for (const client of armClients) {
				if (!client.current) continue
				const models = await client.current.get3DModels()
				if (!(client.current.name in componentModels)) {
					componentModels[client.current.name] = {}
				}
				for (const [id, model] of Object.entries(models)) {
					componentModels[client.current.name][id] = new Geometry({
						geometryType: {
							case: 'mesh',
							value: model,
						},
					})
				}
			}

			console.log(componentModels)
		}
		fetchArmModels()
	})

	const options = $derived.by(() => {
		const interval = refreshRates.get(RefreshRates.poses)
		const results: CreateQueryOptions<
			{
				name: string
				geometries: Geometry[]
			},
			Error,
			{
				name: string
				geometries: Geometry[]
			},
			(string | undefined)[]
		>[] = []

		for (const client of clients) {
			const options = queryOptions({
				enabled: interval !== -1 && client.current !== undefined,
				refetchInterval: interval === 0 ? false : interval,
				queryKey: ['partID', partID(), client.current?.name, 'getGeometries'],
				queryFn: async (): Promise<{ name: string; geometries: Geometry[] }> => {
					if (!client.current) {
						throw new Error('No client')
					}

					logs.add(`Fetching geometries for ${client.current.name}...`)

					const geometries = await client.current.getGeometries()

					return { name: client.current.name, geometries }
				},
			})

			results.push(options)
		}

		return results
	})

	const { updateUUIDs } = usePersistentUUIDs()
	const queries = fromStore(createQueries({ queries: toStore(() => options) }))

	const errors = $derived(
		queries.current.map((query) => query.error).filter((error) => error !== null)
	)

	const geometries = $derived.by(() => {
		const results: WorldObject[] = []

		for (const query of queries.current) {
			if (!query.data) continue

			for (const geometry of query.data.geometries) {
				const resourceName = resourceNames.current.find((item) => item.name === query.data.name)
				const parentFrame = frames.current.find((frame) => frame.name === query.data.name)

				const metadata: Metadata = {
					kinematics: parentFrame?.metadata.kinematics,
				}

				if (resourceName) {
					metadata.color = new Color(
						resourceColors[resourceName.subtype as keyof typeof resourceColors]
					)
				}

				const worldObject = new WorldObject(
					geometry.label ? geometry.label : `${query.data.name} geometry`,
					undefined,
					query.data.name,
					geometry,
					metadata
				)
				results.push(worldObject)
			}
		}

		updateUUIDs(results)

		return results
	})

	setContext<Context>(key, {
		get current() {
			return geometries
		},
		get componentModels() {
			return componentModels
		},
		get errors() {
			return errors
		},
	})
}

export const useGeometries = () => {
	return getContext<Context>(key)
}
