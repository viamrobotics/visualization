import { ArmClient, CameraClient, GantryClient, Geometry, GripperClient } from '@viamrobotics/sdk'
import { createResourceClient, useResourceNames } from '@viamrobotics/svelte-sdk'
import { setContext, getContext, untrack } from 'svelte'
import { RefreshRates, useMachineSettings } from './useMachineSettings.svelte'
import { usePersistentUUIDs } from './usePersistentUUIDs.svelte'
import { useLogs } from './useLogs.svelte'
import { resourceColors } from '$lib/color'
import { Color } from 'three'
import { useFrames } from './useFrames.svelte'
import { useResourceByName } from './useResourceByName.svelte'
import { traits, useWorld } from '$lib/ecs'
import type { Entity } from 'koota'
import { createPose } from '$lib/transform'
import { createBox, createCapsule, createSphere } from '$lib/geometry'
import { type CreateQueryOptions, createQueries, queryOptions } from '@tanstack/svelte-query'
import { RefetchRates } from '$lib/components/RefreshRate.svelte'
import { fromStore, toStore } from 'svelte/store'

const key = Symbol('geometries-context')

interface Context {
	errors: Error[]
}

const colorUtil = new Color()

export const provideGeometries = (partID: () => string) => {
	const resources = useResourceByName()
	const world = useWorld()
	const frames = useFrames()
	const arms = useResourceNames(partID, 'arm')
	const cameras = useResourceNames(partID, 'camera')
	const grippers = useResourceNames(partID, 'gripper')
	const gantries = useResourceNames(partID, 'gantry')

	const logs = useLogs()
	const { refreshRates } = useMachineSettings()

	const framesByName = $derived(
		Object.fromEntries(frames.current.map((frame) => [frame.name, frame]))
	)

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

	const queries = fromStore(createQueries({ queries: toStore(() => options) }))

	const { updateUUIDs } = usePersistentUUIDs()

	$effect(() => {
		let entities: Entity[][] = []

		for (const query of queries.current) {
			if (query.data) {
				untrack(() => {
					const geometries = createGeometries(query.data.name, query.data.geometries)
					updateUUIDs(geometries)
					entities.push(geometries)
				})
			}
		}

		return () => {
			for (const geometries of entities) {
				for (const entity of geometries) {
					entity.destroy()
				}
			}
		}
	})

	const createGeometries = (resource: string, geometries: Geometry[]) => {
		const entities: Entity[] = []

		for (const geometry of geometries) {
			const resourceName = resources.current[resource]
			const name = geometry.label ? geometry.label : `${resource} geometry`
			const pose = createPose(geometry.center)

			const entity = world.spawn(
				traits.UUID,
				traits.Name(name),
				traits.Parent(resource),
				traits.Pose(pose),
				traits.GeometriesAPI
			)

			if (resourceName) {
				const subtype = resourceName.subtype as keyof typeof resourceColors
				entity.add(traits.Color(colorUtil.set(resourceColors[subtype])))
			}

			if (geometry.geometryType.case === 'box') {
				entity.add(traits.Box(createBox(geometry.geometryType.value)))
			} else if (geometry.geometryType.case === 'capsule') {
				entity.add(traits.Capsule(createCapsule(geometry.geometryType.value)))
			} else if (geometry.geometryType.case === 'sphere') {
				entity.add(traits.Sphere(createSphere(geometry.geometryType.value)))
			}

			entities.push(entity)
		}

		return entities
	}

	const errors = $derived(
		queries.current.map((query) => query.error).filter((error) => error !== null)
	)

	setContext<Context>(key, {
		get errors() {
			return errors
		},
	})
}

export const useGeometries = () => {
	return getContext<Context>(key)
}
