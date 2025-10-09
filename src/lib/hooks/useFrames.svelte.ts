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
import { usePartConfig, type PartConfig } from './usePartConfig.svelte'
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
				logs.add('Fetching frames...')
			}
		}
	)

	observe.pre(
		() => [partConfig.isDirty],
		() => {
			if (partConfig.isDirty) {
				settings.current.viewerMode = 'edit'
			} else {
				settings.current.viewerMode = 'monitor'
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
		const components = (partConfig.localPartConfig as unknown as PartConfig)?.components
		const fragmentMods = (partConfig.localPartConfig as unknown as PartConfig)?.fragment_mods
		untrack(() => {
			current.forEach((frame, index) => {
				const component = components.find((component) => component.name === frame.name)
				if (component) {
					current[index].referenceFrame = component.frame.parent

					current[worldObjectIndex].localEditedPose = {
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
								current[index].geometry = {
									...current[index].geometry,
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
								current[index].geometry = {
									...current[index].geometry,
									geometryType: { case: 'sphere', value: { radiusMm: component.frame.geometry.r } },
								} as Geometries
								break
							case 'capsule':
								current[index].geometry = {
									...current[index].geometry,
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
								current[index].geometry = undefined
								break
						}
					} else {
						current[index].geometry = undefined
					}
				} else {
					const fragmentId = partConfig.componentNameToFragmentId[frame.name]
					const fragmentMod = fragmentMods?.find((mod) => mod.fragment_id === fragmentId)
					const componentMod = fragmentMod?.mods.findLast(
						(mod) => mod['$set']?.[`components.${frame.name}.frame`] !== undefined
					)
					if (componentMod) {
						const frameData = componentMod?.['$set']?.[`components.${frame.name}.frame`]
						if (frameData) {
							if (frameData.parent) {
								current[index].referenceFrame = frameData.parent
							}
							if (frameData.translation) {
								current[index].pose = {
									...current[index].pose,
									x: frameData.translation.x,
									y: frameData.translation.y,
									z: frameData.translation.z,
								}
							}
							if (frameData.orientation) {
								current[index].pose = {
									...current[index].pose,
									oX: frameData.orientation.value.x,
									oY: frameData.orientation.value.y,
									oZ: frameData.orientation.value.z,
									theta: frameData.orientation.value.th,
								}
							}
							if (frameData.geometry) {
								switch (frameData.geometry.type) {
									case 'box':
										current[index].geometry = {
											...current[index].geometry,
											geometryType: {
												case: 'box',
												value: {
													dimsMm: {
														x: frameData.geometry.x,
														y: frameData.geometry.y,
														z: frameData.geometry.z,
													},
												},
											},
										} as Geometries
										break
									case 'sphere':
										current[index].geometry = {
											...current[index].geometry,
											geometryType: { case: 'sphere', value: { radiusMm: frameData.geometry.r } },
										} as Geometries
										break
									case 'capsule':
										current[index].geometry = {
											...current[index].geometry,
											geometryType: {
												case: 'capsule',
												value: { radiusMm: frameData.geometry.r, lengthMm: frameData.geometry.l },
											},
										} as Geometries
										break
									default:
										current[index].geometry = undefined
										break
								}
							}
						}
					}
				}
			})
		})
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
