import { getContext, setContext, untrack } from 'svelte'
import {
	useRobotClient,
	createRobotQuery,
	useMachineStatus,
	useResourceNames,
} from '@viamrobotics/svelte-sdk'
import { WorldObject, type Geometries } from '$lib/WorldObject.svelte'
import { observe } from '@threlte/core'
import { useLogs } from './useLogs.svelte'
import { resourceColors } from '$lib/color'
import { usePartConfig, type PartConfigComponents } from './usePartConfig.svelte'
import { useSettings } from './useSettings.svelte'

interface FramesContext {
	current: WorldObject[]
	error?: Error
	fetching: boolean
	getParentFrameOptions: (componentName: string) => string[]
}

const key = Symbol('frames-context')

export const provideFrames = (partID: () => string) => {
	const resourceNames = useResourceNames(partID)
	const client = useRobotClient(partID)
	const machineStatus = useMachineStatus(partID)
	const logs = useLogs()
	const query = createRobotQuery(client, 'frameSystemConfig')
	const revision = $derived(machineStatus.current?.config.revision)
	const partConfig = usePartConfig()
	const settings = useSettings()

	observe.pre(
		() => [revision],
		() => {
			if (!partConfig.isDirty) {
				untrack(() => query.current).refetch()
				settings.current.viewerMode = 'monitor'
				logs.add('Fetching frames...')
			}
		}
	)

	observe.pre(
		() => [partConfig.isDirty],
		() => {
			if (partConfig.isDirty) {
				settings.current.viewerMode = 'edit'
			}
		}
	)

	let current = $derived.by(() => {
		const objects: WorldObject[] = []

		for (const { frame } of query.current.data ?? []) {
			if (frame === undefined) {
				continue
			}

			const resourceName = resourceNames.current.find((item) => item.name === frame.referenceFrame)
			const frameName = frame.referenceFrame ? frame.referenceFrame : 'Unnamed frame'

			objects.push(
				new WorldObject(
					frameName,
					frame.poseInObserverFrame?.pose,
					frame.poseInObserverFrame?.referenceFrame,
					frame.physicalObject,
					resourceName
						? {
								color: resourceColors[resourceName.subtype as keyof typeof resourceColors],
							}
						: undefined
				)
			)
		}

		return objects
	})

	$effect.pre(() => {
		;(partConfig.localPartConfig.toJson() as unknown as PartConfigComponents)?.components?.forEach(
			(component) => {
				untrack(() => {
					const worldObjectIndex = current.findIndex((frame) => frame.name === component.name)
					if (worldObjectIndex === -1) {
						return
					}

					current[worldObjectIndex].referenceFrame = component.frame.parent

					current[worldObjectIndex].pose = {
						x: component.frame.translation.x,
						y: component.frame.translation.y,
						z: component.frame.translation.z,
						oX: component.frame.orientation.value.x,
						oY: component.frame.orientation.value.y,
						oZ: component.frame.orientation.value.z,
						theta: component.frame.orientation.value.th,
					}

					if (component.frame.geometry) {
						switch (component.frame.geometry.type) {
							case 'box':
								current[worldObjectIndex].geometry = {
									...current[worldObjectIndex].geometry,
									geometryType: {
										case: 'box',
										value: {
											dimsMm: {
												x: component.frame.geometry.x,
												y: component.frame.geometry.y,
												z: component.frame.geometry.z,
											},
										},
									},
								} as Geometries
								break
							case 'sphere':
								current[worldObjectIndex].geometry = {
									...current[worldObjectIndex].geometry,
									geometryType: { case: 'sphere', value: { radiusMm: component.frame.geometry.r } },
								} as Geometries
								break
							case 'capsule':
								current[worldObjectIndex].geometry = {
									...current[worldObjectIndex].geometry,
									geometryType: {
										case: 'capsule',
										value: {
											radiusMm: component.frame.geometry.r,
											lengthMm: component.frame.geometry.l,
										},
									},
								} as Geometries
								break
							default:
								current[worldObjectIndex].geometry = undefined
								break
						}
					} else {
						current[worldObjectIndex].geometry = undefined
					}
				})
			}
		)
		untrack(() => (current = [...current]))
	})

	const error = $derived(query.current.error ?? undefined)
	const fetching = $derived(query.current.isFetching)

	const getParentFrameOptions = (componentName: string) => {
		const validFrames = new Set(current.map((frame) => frame.name))
		validFrames.add('world')

		const frameNameQueue = [componentName]
		while (frameNameQueue.length > 0) {
			const frameName = frameNameQueue.shift()
			if (frameName) {
				validFrames.delete(frameName)
				const frames = current.filter((frame) => frame.referenceFrame === frameName)
				for (const frame of frames) {
					frameNameQueue.push(frame.name)
				}
			}
		}
		return Array.from(validFrames)
	}

	setContext<FramesContext>(key, {
		getParentFrameOptions,
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
