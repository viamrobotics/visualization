import { getContext, setContext, untrack } from 'svelte'
import {
	useRobotClient,
	createRobotQuery,
	useMachineStatus,
	useResourceNames,
} from '@viamrobotics/svelte-sdk'
import { WorldObject } from '$lib/WorldObject'
import { observe } from '@threlte/core'
import { useLogs } from './useLogs.svelte'
import { resourceColors } from '$lib/color'
import { createResourceId } from '$lib/resource'

interface FramesContext {
	current: WorldObject[]
	error?: Error
	fetching: boolean
}

const key = Symbol('frames-context')

export const provideFrames = (partID: () => string) => {
	const resourceNames = useResourceNames(partID)
	const client = useRobotClient(partID)
	const machineStatus = useMachineStatus(partID)
	const logs = useLogs()
	const query = createRobotQuery(client, 'frameSystemConfig')
	const revision = $derived(machineStatus.current?.config.revision)
	const components = $derived(
		resourceNames.current.filter((resource) => resource.type === 'component')
	)

	$inspect(resourceNames.current)
	observe(
		() => [revision],
		() => {
			untrack(() => query.current).refetch()
			logs.add('Fetching frames...')
		}
	)

	const frames = $derived(query.current.data ?? [])
	const current = $derived.by(() => {
		const results: WorldObject[] = []

		if (frames.length === 0) {
			return results
		}

		for (const component of components) {
			const frame = frames.find(({ frame }) => frame?.referenceFrame === component.name)?.frame

			if (frame) {
				results.push(
					new WorldObject(
						component.name,
						frame.poseInObserverFrame?.pose,
						frame.poseInObserverFrame?.referenceFrame,
						frame.physicalObject?.geometryType,
						component
							? {
									color: resourceColors[component.subtype as keyof typeof resourceColors],
								}
							: undefined
					)
				)
			}
		}

		return results
	})

	const current2 = $derived.by(() => {
		const result: Record<string, WorldObject> = {}

		for (const { frame } of query.current.data ?? []) {
			if (frame === undefined) {
				continue
			}

			const resourceName = resourceNames.current.find((item) => item.name === frame.referenceFrame)

			if (resourceName === undefined) {
				continue
			}

			result[createResourceId(resourceName)] = new WorldObject(
				frame.referenceFrame ? frame.referenceFrame : 'Unnamed frame',
				frame.poseInObserverFrame?.pose,
				frame.poseInObserverFrame?.referenceFrame,
				frame.physicalObject?.geometryType,
				resourceName
					? {
							color: resourceColors[resourceName.subtype as keyof typeof resourceColors],
						}
					: undefined
			)
		}

		return result
	})

	const error = $derived(query.current.error ?? undefined)
	const fetching = $derived(query.current.isFetching)

	setContext<FramesContext>(key, {
		get current() {
			return current
		},
		get error() {
			return error
		},
		get fetching() {
			return fetching
		},
	})
}

export const useFrames = (): FramesContext => {
	return getContext<FramesContext>(key)
}
