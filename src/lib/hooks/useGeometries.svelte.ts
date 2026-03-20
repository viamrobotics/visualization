import { ArmClient, CameraClient, GantryClient, GripperClient } from '@viamrobotics/sdk'
import {
	createResourceClient,
	createResourceQuery,
	useResourceNames,
} from '@viamrobotics/svelte-sdk'
import { type ConfigurableTrait, type Entity } from 'koota'
import { getContext, setContext, untrack } from 'svelte'
import { Color } from 'three'

import { resourceColors } from '$lib/color'
import { RefetchRates } from '$lib/components/overlay/RefreshRate.svelte'
import { traits, useWorld } from '$lib/ecs'
import { updateGeometryTrait } from '$lib/ecs/traits'
import { createPose } from '$lib/transform'

import { useEnvironment } from './useEnvironment.svelte'
import { useLogs } from './useLogs.svelte'
import { RefreshRates, useMachineSettings } from './useMachineSettings.svelte'
import { useResourceByName } from './useResourceByName.svelte'

const key = Symbol('geometries-context')

interface Context {
	refetch: () => void
}

const colorUtil = new Color()

export const provideGeometries = (partID: () => string) => {
	const environment = useEnvironment()
	const resources = useResourceByName()
	const world = useWorld()
	const logs = useLogs()
	const arms = useResourceNames(partID, 'arm')
	const cameras = useResourceNames(partID, 'camera')
	const grippers = useResourceNames(partID, 'gripper')
	const gantries = useResourceNames(partID, 'gantry')

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

	const interval = $derived(refreshRates.get(RefreshRates.poses))

	const options = $derived.by(() => {
		return {
			enabled:
				refreshRates.get(RefreshRates.poses) !== RefetchRates.OFF &&
				environment.current.viewerMode === 'monitor',
			refetchInterval: interval === RefetchRates.MANUAL ? (false as const) : interval,
		}
	})

	const armQueries = $derived(
		armClients.map(
			(client) =>
				[client.current?.name, createResourceQuery(client, 'getGeometries', () => options)] as const
		)
	)
	const gripperQueries = $derived(
		gripperClients.map(
			(client) =>
				[client.current?.name, createResourceQuery(client, 'getGeometries', () => options)] as const
		)
	)
	const cameraQueries = $derived(
		cameraClients.map(
			(client) =>
				[client.current?.name, createResourceQuery(client, 'getGeometries', () => options)] as const
		)
	)
	const gantryQueries = $derived(
		gantryClients.map(
			(client) =>
				[client.current?.name, createResourceQuery(client, 'getGeometries', () => options)] as const
		)
	)

	const queries = $derived([...armQueries, ...gripperQueries, ...cameraQueries, ...gantryQueries])

	$effect(() => {
		if (interval === RefetchRates.FPS_30 || interval === RefetchRates.FPS_60) {
			return logs.add(`Fetching geometries every ${interval}ms...`)
		}

		for (const [name, query] of queries) {
			untrack(() => {
				$effect(() => {
					if (query.isFetching) {
						logs.add(`Fetching geometries for ${name}...`)
					} else if (query.error) {
						logs.add(`Error fetching geometries from ${name}: ${query.error.message}`, 'error')
					}
				})
			})
		}
	})

	const entities = new Map<string, Entity>()
	const queryEntityKeys = new Map<string, Set<string>>()

	$effect(() => {
		const activeQueryKeys = new Set<string>()
		const currentPartID = partID()

		for (const [name, query] of queries) {
			if (!name) {
				continue
			}

			const queryKey = `${currentPartID}:${name}`
			activeQueryKeys.add(queryKey)

			$effect(() => {
				const nextKeys = new Set<string>()
				const resourceName = resources.current[name]
				const subtype = resourceName?.subtype as keyof typeof resourceColors | undefined

				if (query.data) {
					let index = 0

					for (const geometry of query.data) {
						index += 1

						const label = geometry.label || `${name} geometry ${index}`
						const entityKey = `${currentPartID}:${name}:${label}`
						nextKeys.add(entityKey)

						const center = createPose(geometry.center)
						const existing = entities.get(entityKey)

						if (existing) {
							existing.set(traits.Center, center)
							updateGeometryTrait(existing, geometry)
							continue
						}

						const entityTraits: ConfigurableTrait[] = [
							traits.Parent(name),
							traits.Name(label),
							traits.Center(center),
							traits.GeometriesAPI,
							traits.Geometry(geometry),
						]

						if (subtype) {
							entityTraits.push(
								traits.Color(subtype ? colorUtil.set(resourceColors[subtype]) : undefined)
							)
						}

						const entity = world.spawn(...entityTraits)
						entities.set(entityKey, entity)
					}
				}

				const prevKeys = queryEntityKeys.get(queryKey) ?? new Set<string>()

				// Remove entities no longer present for this specific query
				for (const key of prevKeys) {
					if (!nextKeys.has(key)) {
						entities.get(key)?.destroy()
						entities.delete(key)
					}
				}

				queryEntityKeys.set(queryKey, nextKeys)
			})
		}

		// Clean up owners whose queries disappeared entirely
		for (const [queryKey, keys] of queryEntityKeys) {
			if (!activeQueryKeys.has(queryKey)) {
				for (const key of keys) {
					const entity = entities.get(key)
					if (entity && world.has(entity)) {
						entity.destroy()
					}

					entities.delete(key)
				}

				queryEntityKeys.delete(queryKey)
			}
		}
	})

	// Clear all entities on unmount
	$effect(() => {
		return () => {
			for (const [, entity] of entities) {
				entity?.destroy()
			}

			entities.clear()
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

export const useGeometries = () => {
	return getContext<Context>(key)
}
