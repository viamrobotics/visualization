import { ArmClient, CameraClient, GantryClient, Geometry, GripperClient } from '@viamrobotics/sdk'
import {
	createResourceClient,
	createResourceQuery,
	useResourceNames,
} from '@viamrobotics/svelte-sdk'
import { setContext, getContext } from 'svelte'
import { useMachineSettings } from './useMachineSettings.svelte'
import { WorldObject } from '$lib/WorldObject.svelte'
import { usePersistentUUIDs } from './usePersistentUUIDs.svelte'
import { useLogs } from './useLogs.svelte'
import { resourceColors } from '$lib/color'
import { Color } from 'three'
import { useFrames } from './useFrames.svelte'
import { RefetchRates } from '$lib/components/RefreshRate.svelte'
import { useResourceByName } from './useResourceByName.svelte'
import { traits, useWorld } from '$lib/ecs'
import type { ConfigurableTrait, Entity } from 'koota'
import { createPose } from '$lib/transform'
import { createBox, createCapsule, createSphere } from '$lib/geometry'

const key = Symbol('geometries-context')

interface Context {
	current: WorldObject[]
	errors: Error[]
}

const colorUtil = new Color()

export const provideGeometries = (partID: () => string) => {
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
		arms.current.map((arm) =>
			createResourceClient(
				ArmClient,
				() => partID(),
				() => arm.name
			)
		)
	)
	const gripperClients = $derived(
		grippers.current.map((gripper) =>
			createResourceClient(
				GripperClient,
				() => partID(),
				() => gripper.name
			)
		)
	)
	const cameraClients = $derived(
		cameras.current.map((camera) =>
			createResourceClient(
				CameraClient,
				() => partID(),
				() => camera.name
			)
		)
	)
	const gantryClients = $derived(
		gantries.current.map((gantry) =>
			createResourceClient(
				GantryClient,
				() => partID(),
				() => gantry.name
			)
		)
	)

	const refetchInterval = $derived(refreshRates.get('Poses') ?? false)

	const armQueries = $derived.by(() => {
		const results = []
		for (const client of armClients) {
			if (client.current && framesByName[client.current.name]) {
				results.push([
					client.current.name,
					createResourceQuery(client, 'getGeometries', () => ({ refetchInterval })),
				] as const)
			}
		}

		return results
	})

	const cameraQueries = $derived.by(() => {
		const results = []
		for (const client of cameraClients) {
			if (client.current && framesByName[client.current.name]) {
				results.push([
					client.current.name,
					createResourceQuery(client, 'getGeometries', () => ({ refetchInterval })),
				] as const)
			}
		}

		return results
	})

	const gripperQueries = $derived.by(() => {
		const results = []
		for (const client of gripperClients) {
			if (client.current && framesByName[client.current.name]) {
				results.push([
					client.current.name,
					createResourceQuery(client, 'getGeometries', () => ({ refetchInterval })),
				] as const)
			}
		}

		return results
	})

	const gantryQueries = $derived.by(() => {
		const results = []
		for (const client of gantryClients) {
			if (client.current && framesByName[client.current.name]) {
				results.push([
					client.current.name,
					createResourceQuery(client, 'getGeometries', () => ({ refetchInterval })),
				] as const)
			}
		}

		return results
	})

	const { updateUUIDs } = usePersistentUUIDs()

	$effect(() => {
		let entities: Entity[] = []

		for (const [name, query] of armQueries) {
			if (query.current.data) {
				entities = [...entities, ...createGeometries(name, query.current.data)]
			}
		}

		updateUUIDs(entities)

		return () => {
			for (const entity of entities) {
				entity.destroy()
			}
		}
	})

	$effect(() => {
		let entities: Entity[] = []

		for (const [name, query] of cameraQueries) {
			if (query.current.data) {
				entities = [...entities, ...createGeometries(name, query.current.data)]
			}
		}

		updateUUIDs(entities)

		return () => {
			for (const entity of entities) {
				entity.destroy()
			}
		}
	})

	$effect(() => {
		let entities: Entity[] = []

		for (const [name, query] of gripperQueries) {
			if (query.current.data) {
				entities = [...entities, ...createGeometries(name, query.current.data)]
			}
		}

		updateUUIDs(entities)

		return () => {
			for (const entity of entities) entity.destroy()
		}
	})

	$effect(() => {
		let entities: Entity[] = []

		for (const [name, query] of gantryQueries) {
			if (query.current.data) {
				entities = [...entities, ...createGeometries(name, query.current.data)]
			}
		}

		updateUUIDs(entities)

		return () => {
			for (const entity of entities) {
				entity.destroy()
			}
		}
	})

	const createGeometries = (resource: string, geometries: Geometry[]) => {
		const entities: Entity[] = []

		for (const geometry of geometries) {
			const resourceName = resources.current[resource]
			const name = geometry.label ? geometry.label : `${resource} geometry`
			const pose = createPose(geometry.center)

			const entityTraits: ConfigurableTrait[] = [
				traits.UUID,
				traits.Name(name),
				traits.Parent(resource),
				traits.Pose(pose),
				traits.GeometriesAPI,
			]

			if (resourceName) {
				const subtype = resourceName.subtype as keyof typeof resourceColors
				entityTraits.push(traits.Color(colorUtil.set(resourceColors[subtype])))
			}

			if (geometry.geometryType.case === 'box') {
				entityTraits.push(traits.Box(createBox(geometry.geometryType.value)))
			} else if (geometry.geometryType.case === 'capsule') {
				entityTraits.push(traits.Capsule(createCapsule(geometry.geometryType.value)))
			} else if (geometry.geometryType.case === 'sphere') {
				entityTraits.push(traits.Sphere(createSphere(geometry.geometryType.value)))
			}

			const entity = world.spawn(...entityTraits)

			entities.push(entity)
		}

		return entities
	}

	const errors = []
	// const errors = $derived(
	// 	queries.current.map((query) => query.error).filter((error) => error !== null)
	// )

	const resources = useResourceByName()
	const world = useWorld()

	const geometries = []

	// const geometries = $derived.by(() => {
	// 	const results: WorldObject[] = []

	// 	for (const query of queries.current) {
	// 		if (!query.data) continue

	// 		for (const geometry of query.data.geometries) {
	// 			const resourceName = resourceNames.current.find((item) => item.name === query.data.name)
	// 			const worldObject = new WorldObject(
	// 				geometry.label ? geometry.label : `${query.data.name} geometry`,
	// 				undefined,
	// 				query.data.name,
	// 				geometry,
	// 				resourceName
	// 					? {
	// 							color: new Color(
	// 								resourceColors[resourceName.subtype as keyof typeof resourceColors]
	// 							),
	// 						}
	// 					: undefined
	// 			)

	// 			results.push(worldObject)
	// 		}
	// 	}

	// 	updateUUIDs(results)

	// 	return results
	// })

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
