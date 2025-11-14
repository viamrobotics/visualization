import { ArmClient, CameraClient, GantryClient, Geometry, GripperClient } from '@viamrobotics/sdk'
import { createQueries, queryOptions, type CreateQueryOptions } from '@tanstack/svelte-query'
import { createResourceClient, useResourceNames } from '@viamrobotics/svelte-sdk'
import { setContext, getContext } from 'svelte'
import { fromStore, toStore } from 'svelte/store'
import { useMachineSettings, RefreshRates } from './useMachineSettings.svelte'
import { WorldObject } from '$lib/WorldObject.svelte'
import { usePersistentUUIDs } from './usePersistentUUIDs.svelte'
import { useLogs } from './useLogs.svelte'
import { resourceColors } from '$lib/color'
import { Color } from 'three'
import { useFrames } from './useFrames.svelte'
import { RefetchRates } from '$lib/components/RefreshRate.svelte'
import { useResourceByName } from './useResourceByName.svelte'
import { traits, useWorld } from '$lib/ecs'
import { trait } from 'koota'
import { createPose } from '$lib/transform'
import { createBox, createCapsule, createSphere } from '$lib/geometry'

const key = Symbol('geometries-context')

interface Context {
	current: WorldObject[]
	errors: Error[]
}

export const provideGeometries = (partID: () => string) => {
	const frames = useFrames()
	const resourceNames = useResourceNames(partID)
	const arms = useResourceNames(partID, 'arm')
	const cameras = useResourceNames(partID, 'camera')
	const grippers = useResourceNames(partID, 'gripper')
	const gantries = useResourceNames(partID, 'gantry')

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
				enabled: interval !== RefetchRates.OFF && client.current !== undefined,
				refetchInterval: interval === RefetchRates.MANUAL ? false : interval,
				queryKey: ['getGeometries', 'partID', partID(), client.current?.name],
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

	const resources = useResourceByName()
	const world = useWorld()

	const GetGeometriesAPI = trait()

	$effect(() => {
		for (const query of queries.current) {
			if (!query.data) continue

			const entities = world.query(GetGeometriesAPI)

			for (const geometry of query.data.geometries) {
				const resourceName = resources.current[query.data.name]
				const name = geometry.label ? geometry.label : `${query.data.name} geometry`

				const existing = entities.find((entity) => entity.get(traits.Name) === name)
				const pose = createPose(geometry.center)

				if (existing) {
					existing.set(traits.Pose, pose)
				}

				const entity = world.spawn(
					traits.UUID,
					traits.Name(name),
					traits.Pose(pose),
					GetGeometriesAPI
				)

				if (geometry.geometryType.case === 'box') {
					entity.add(traits.Box(createBox(geometry.geometryType.value)))
				} else if (geometry.geometryType.case === 'capsule') {
					entity.add(traits.Capsule(createCapsule(geometry.geometryType.value)))
				} else if (geometry.geometryType.case === 'sphere') {
					entity.add(traits.Sphere(createSphere(geometry.geometryType.value)))
				}
			}
		}
	})

	const geometries = $derived.by(() => {
		const results: WorldObject[] = []

		for (const query of queries.current) {
			if (!query.data) continue

			for (const geometry of query.data.geometries) {
				const resourceName = resourceNames.current.find((item) => item.name === query.data.name)
				const worldObject = new WorldObject(
					geometry.label ? geometry.label : `${query.data.name} geometry`,
					undefined,
					query.data.name,
					geometry,
					resourceName
						? {
								color: new Color(
									resourceColors[resourceName.subtype as keyof typeof resourceColors]
								),
							}
						: undefined
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
		get errors() {
			return errors
		},
	})
}

export const useGeometries = () => {
	return getContext<Context>(key)
}
