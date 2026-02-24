import { ArmClient, CameraClient, GantryClient, GripperClient } from '@viamrobotics/sdk'
import { untrack, setContext, getContext } from 'svelte'
import { RefreshRates, useMachineSettings } from './useMachineSettings.svelte'
import {
	createResourceClient,
	createResourceQuery,
	useResourceNames,
} from '@viamrobotics/svelte-sdk'
import { useLogs } from './useLogs.svelte'
import { resourceColors } from '$lib/color'
import { Color } from 'three'
import { useResourceByName } from './useResourceByName.svelte'
import { traits, useWorld } from '$lib/ecs'
import { type ConfigurableTrait, type Entity } from 'koota'
import { createPose } from '$lib/transform'
import { RefetchRates } from '$lib/components/overlay/RefreshRate.svelte'
import { useEnvironment } from './useEnvironment.svelte'

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

	const queries = $derived([...armQueries, ...gripperQueries, ...cameraQueries, ...gantryQueries])

	const entities = new Map<string, Entity | undefined>()

	$effect(() => {
		const active: Record<string, boolean> = {}

		for (const [name, query] of queries) {
			untrack(() => {
				$effect(() => {
					if (name && query.data) {
						let index = 0

						for (const geometry of query.data) {
							index += 1

							const resourceName = resources.current[name]
							const label = geometry.label ? geometry.label : `${name} geometry ${index}`

							active[`${name}:${label}`] = true

							const pose = createPose(geometry.center)
							const subtype = resourceName?.subtype as keyof typeof resourceColors | undefined

							const existing = entities.get(`${name}:${label}`)

							if (existing) {
								existing.set(traits.Pose, pose)
								continue
							}

							const entityTraits: ConfigurableTrait[] = [
								traits.Parent(name),
								traits.Name(label),
								traits.Pose(pose),
								traits.GeometriesAPI,
								traits.Geometry(geometry),
							]

							if (subtype) {
								entityTraits.push(traits.Color(colorUtil.set(resourceColors[subtype])))
							}

							const entity = world.spawn(...entityTraits)

							entities.set(`${name}:${label}`, entity)
						}
					}
				})
			})
		}

		// Clean up non-active entities
		for (const [label, entity] of entities) {
			if (!active[label]) {
				entity?.destroy()
				entities.delete(label)
			}
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
