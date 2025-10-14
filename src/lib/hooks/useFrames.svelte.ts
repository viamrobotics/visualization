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
import { usePartConfig, type Frame, type PartConfig } from './usePartConfig.svelte'
import { useSettings } from './useSettings.svelte'
import { Pose } from '@viamrobotics/sdk'
import { Color } from 'three'

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
	const revision = $derived(machineStatus.current?.config?.revision)
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
								color: new Color(
									resourceColors[resourceName.subtype as keyof typeof resourceColors]
								),
							}
						: undefined
				)
			)
		}

		return objects
	})

	let currentWorldObjects: Record<string, WorldObject> = {}
	const getWorldObjects = () => ({ ...currentWorldObjects })
	const getWorldObject = (componentName: string) => currentWorldObjects[componentName]
	const setWorldObject = (
		component: PartConfig['components'][number],
		worldObject: WorldObject
	) => {
		if (!component.frame) {
			return
		}
		worldObject.referenceFrame = component.frame.parent
		worldObject.localEditedPose = {
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
					worldObject.geometry = {
						...worldObject.geometry,
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
					worldObject.geometry = {
						...worldObject.geometry,
						geometryType: { case: 'sphere', value: { radiusMm: component.frame.geometry.r } },
					} as Geometries
					break
				case 'capsule':
					worldObject.geometry = {
						...worldObject.geometry,
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
					worldObject.geometry = undefined
					break
			}
		} else {
			worldObject.geometry = undefined
		}
		currentWorldObjects[component.name] = worldObject
	}
	const deleteWorldObject = (componentName: string) => {
		delete currentWorldObjects[componentName]
	}

	$effect.pre(() => {
		untrack(() => {
			currentWorldObjects = {}
			for (const currentWorldObject of current) {
				currentWorldObjects[currentWorldObject.name] = currentWorldObject
			}
		})
		const components = (partConfig.localPartConfig.toJson() as unknown as PartConfig)?.components
		const fragmentMods = (partConfig.localPartConfig.toJson() as unknown as PartConfig)
			?.fragment_mods
		const fragmentDefinedComponents = Object.values(partConfig.componentNameToFragmentId)

		// deal with part defined frame config
		for (const component of components || []) {
			const worldObject = getWorldObject(component.name)
			if (worldObject && component.frame) {
				setWorldObject(component, worldObject)
			} else if (component.frame && Object.keys(getWorldObjects()).length > 0) {
				// extra clause to prevent adding a component to the world objects when it may be loaded via frame system config later (first tick issue where config updated but current world objects not triggered yet)
				const pose = new Pose({
					x: component.frame.translation.x,
					y: component.frame.translation.y,
					z: component.frame.translation.z,
					oX: component.frame.orientation.value.x,
					oY: component.frame.orientation.value.y,
					oZ: component.frame.orientation.value.z,
					theta: component.frame.orientation.value.th,
				})
				const newWorldObject = new WorldObject(component.name, pose, component.frame.parent)
				setWorldObject(component, newWorldObject)
			} else {
				deleteWorldObject(component.name)
			}
		}

		// deal with fragment defined components
		for (const fragmentComponentName of fragmentDefinedComponents || []) {
			const worldObject = getWorldObject(fragmentComponentName)
			const fragmentId = partConfig.componentNameToFragmentId[fragmentComponentName]
			const fragmentMod = fragmentMods?.find((mod) => mod.fragment_id === fragmentId)
			if (!fragmentMod) {
				continue
			}
			const setComponentModIndex = fragmentMod.mods.findLastIndex(
				(mod) => mod['$set'][`components.${fragmentComponentName}.frame`] !== undefined
			)
			const unsetComponentModIndex = fragmentMod.mods.findLastIndex(
				(mod) => mod['$unset'][`components.${fragmentComponentName}.frame`] !== undefined
			)

			if (setComponentModIndex < unsetComponentModIndex) {
				deleteWorldObject(fragmentComponentName)
			} else if (unsetComponentModIndex < setComponentModIndex) {
				const frameData = fragmentMod.mods[setComponentModIndex]['$set'][
					`components.${fragmentComponentName}.frame`
				] as Frame
				const componentConfig: PartConfig['components'][number] = {
					name: fragmentComponentName,
					frame: frameData,
				}
				if (worldObject) {
					setWorldObject(componentConfig, worldObject)
				} else {
					const pose = new Pose({
						x: frameData.translation.x,
						y: frameData.translation.y,
						z: frameData.translation.z,
						oX: frameData.orientation.value.x,
						oY: frameData.orientation.value.y,
						oZ: frameData.orientation.value.z,
						theta: frameData.orientation.value.th,
					})
					const newWorldObject = new WorldObject(fragmentComponentName, pose, frameData.parent)
					setWorldObject(componentConfig, newWorldObject)
				}
			}
		}

		untrack(() => {
			current = [...Object.values(getWorldObjects())]
		})
	})

	// $effect.pre(() => {
	// 	const components = (partConfig.localPartConfig.toJson() as unknown as PartConfig)?.components
	// 	const fragmentMods = (partConfig.localPartConfig.toJson() as unknown as PartConfig)
	// 		?.fragment_mods
	// 	const updatedWorldObjects: WorldObject[] = []
	// 	untrack(() => {
	// 		current.forEach((worldObject) => {
	// 			const component = components?.find((component) => component.name === worldObject.name)
	// 			if (component) {
	// 				// handling part defined frames
	// 				if (component.frame) {
	// 					worldObject.referenceFrame = component.frame.parent

	// 					worldObject.localEditedPose = {
	// 						x: component.frame.translation.x,
	// 						y: component.frame.translation.y,
	// 						z: component.frame.translation.z,
	// 						oX: component.frame.orientation.value.x,
	// 						oY: component.frame.orientation.value.y,
	// 						oZ: component.frame.orientation.value.z,
	// 						theta: component.frame.orientation.value.th,
	// 					}

	// 					if (component.frame.geometry) {
	// 						switch (component.frame.geometry.type) {
	// 							case 'box':
	// 								worldObject.geometry = {
	// 									...worldObject.geometry,
	// 									geometryType: {
	// 										case: 'box',
	// 										value: {
	// 											dimsMm: {
	// 												x: component.frame.geometry.x,
	// 												y: component.frame.geometry.y,
	// 												z: component.frame.geometry.z,
	// 											},
	// 										},
	// 									},
	// 								} as Geometries
	// 								break
	// 							case 'sphere':
	// 								worldObject.geometry = {
	// 									...worldObject.geometry,
	// 									geometryType: { case: 'sphere', value: { radiusMm: component.frame.geometry.r } },
	// 								} as Geometries
	// 								break
	// 							case 'capsule':
	// 								worldObject.geometry = {
	// 									...worldObject.geometry,
	// 									geometryType: {
	// 										case: 'capsule',
	// 										value: {
	// 											radiusMm: component.frame.geometry.r,
	// 											lengthMm: component.frame.geometry.l,
	// 										},
	// 									},
	// 								} as Geometries
	// 								break
	// 							default:
	// 								worldObject.geometry = undefined
	// 								break
	// 						}
	// 					} else {
	// 						worldObject.geometry = undefined
	// 					}
	// 					updatedWorldObjects.push(worldObject)
	// 				}
	// 			} else {
	// 				const fragmentId = partConfig.componentNameToFragmentId[worldObject.name]
	// 				const fragmentMod = fragmentMods?.find((mod) => mod.fragment_id === fragmentId)
	// 				const setComponentModIndex = fragmentMod?.mods.findLastIndex(
	// 					(mod) => mod['$set']?.[`components.${worldObject.name}.frame`] !== undefined
	// 				) ?? -1
	// 				const unsetComponentModIndex = fragmentMod?.mods.findLastIndex(
	// 					(mod) => mod['$unset']?.[`components.${worldObject.name}.frame`] !== undefined
	// 				) ?? -1
	// 				if (setComponentModIndex === -1 && unsetComponentModIndex === -1) {
	// 					// no mods just push in as is
	// 					updatedWorldObjects.push(worldObject)
	// 				} else if (unsetComponentModIndex !== -1 && unsetComponentModIndex < setComponentModIndex) {
	// 					// set mod is newer than unset mod
	// 					const frameData = fragmentMod?.mods[setComponentModIndex]['$set']?.[`components.${worldObject.name}.frame`]
	// 					if (frameData) {
	// 						if (frameData.parent) {
	// 							worldObject.referenceFrame = frameData.parent
	// 						}
	// 						if (frameData.translation) {
	// 							worldObject.pose = {
	// 								...worldObject.pose,
	// 								x: frameData.translation.x,
	// 								y: frameData.translation.y,
	// 								z: frameData.translation.z,
	// 							}
	// 						}
	// 						if (frameData.orientation) {
	// 							worldObject.pose = {
	// 								...worldObject.pose,
	// 								oX: frameData.orientation.value.x,
	// 								oY: frameData.orientation.value.y,
	// 								oZ: frameData.orientation.value.z,
	// 								theta: frameData.orientation.value.th,
	// 							}
	// 						}
	// 						if (frameData.geometry) {
	// 							switch (frameData.geometry.type) {
	// 								case 'box':
	// 									worldObject.geometry = {
	// 										...worldObject.geometry,
	// 										geometryType: {
	// 											case: 'box',
	// 											value: {
	// 												dimsMm: {
	// 													x: frameData.geometry.x,
	// 													y: frameData.geometry.y,
	// 													z: frameData.geometry.z,
	// 												},
	// 											},
	// 										},
	// 									} as Geometries
	// 									break
	// 								case 'sphere':
	// 									worldObject.geometry = {
	// 										...worldObject.geometry,
	// 										geometryType: { case: 'sphere', value: { radiusMm: frameData.geometry.r } },
	// 									} as Geometries
	// 									break
	// 								case 'capsule':
	// 									worldObject.geometry = {
	// 										...worldObject.geometry,
	// 										geometryType: {
	// 											case: 'capsule',
	// 											value: { radiusMm: frameData.geometry.r, lengthMm: frameData.geometry.l },
	// 										},
	// 									} as Geometries
	// 									break
	// 								default:
	// 									worldObject.geometry = undefined
	// 									break
	// 							}
	// 						}
	// 						updatedWorldObjects.push(worldObject)
	// 					}
	// 				}
	// 				// implicit else we have an unset so just don't add the world object in
	// 			}
	// 		})
	// 	})
	// 	untrack(() => (current = [...updatedWorldObjects]))
	// })

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
