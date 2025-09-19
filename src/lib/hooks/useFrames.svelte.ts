import { getContext, setContext, untrack } from 'svelte'
import {
	useRobotClient,
	createRobotQuery,
	useMachineStatus,
	useResourceNames,
} from '@viamrobotics/svelte-sdk'
import { WorldObject } from '$lib/WorldObject.svelte'
import { observe } from '@threlte/core'
import { useLogs } from './useLogs.svelte'
import { resourceColors } from '$lib/color'
import type { Pose } from '@viamrobotics/sdk'

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

	observe.pre(
		() => [revision],
		() => {
			untrack(() => query.current).refetch()
			logs.add('Fetching frames...')
		}
	)

	const current = $derived.by(() => {
		const objects: WorldObject[] = []

		for (const { frame } of query.current.data ?? []) {
			if (frame === undefined) {
				continue
			}

			const resourceName = resourceNames.current.find((item) => item.name === frame.referenceFrame)
			const frameColor = resourceName
				? { color: resourceColors[resourceName.subtype as keyof typeof resourceColors] }
				: undefined

			objects.push(
				new WorldObject(
					frame.referenceFrame ? frame.referenceFrame : 'Unnamed frame',
					frame.poseInObserverFrame?.pose,
					frame.poseInObserverFrame?.referenceFrame,
					undefined,
					frameColor
				)
			)

			if (frame.physicalObject?.geometryType) {
				const combinedPose: Pose = {
					...frame.poseInObserverFrame?.pose,
					x: (frame.poseInObserverFrame?.pose?.x ?? 0) + (frame.physicalObject.center?.x ?? 0),
					y: (frame.poseInObserverFrame?.pose?.y ?? 0) + (frame.physicalObject.center?.y ?? 0),
					z: (frame.poseInObserverFrame?.pose?.z ?? 0) + (frame.physicalObject.center?.z ?? 0),
					oX: frame.poseInObserverFrame?.pose?.oX ?? 0,
					oY: frame.poseInObserverFrame?.pose?.oY ?? 0,
					oZ: frame.poseInObserverFrame?.pose?.oZ ?? 0,
					theta: frame.poseInObserverFrame?.pose?.theta ?? 0,
				}

				objects.push(
					new WorldObject(
						`${frame.referenceFrame ? frame.referenceFrame : 'Unnamed frame'}_physical`,
						combinedPose,
						frame.poseInObserverFrame?.referenceFrame,
						frame.physicalObject.geometryType,
						frameColor
					)
				)
			}
		}

		return objects
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
