import { getContext, setContext, untrack } from 'svelte'
import { useRobotClient, createRobotQuery, useMachineStatus } from '@viamrobotics/svelte-sdk'
import { WorldObject } from '$lib/WorldObject.svelte'
import { useLogs } from './useLogs.svelte'
import { resourceNameToColor } from '$lib/color'
import type { Frame } from '$lib/frame'
import { usePartConfig, type PartConfig } from './usePartConfig.svelte'
import { useEnvironment } from './useEnvironment.svelte'
import { createPoseFromFrame } from '$lib/transform'
import { createGeometryFromFrame, createBox, createCapsule, createSphere } from '$lib/geometry'
import { useResourceByName } from './useResourceByName.svelte'
import { usePersistentUUIDs } from './usePersistentUUIDs.svelte'
import { traits, useWorld } from '$lib/ecs'
import { parsePlyInput } from '$lib/ply'
import type { Entity } from 'koota'

interface FramesContext {
	current: WorldObject[]
	getParentFrameOptions: (componentName: string) => string[]
}

const key = Symbol('frames-context')

export const provideFrames = (partID: () => string) => {
	const world = useWorld()
	const resourceByName = useResourceByName()
	const client = useRobotClient(partID)
	const machineStatus = useMachineStatus(partID)
	const logs = useLogs()
	const query = createRobotQuery(client, 'frameSystemConfig')
	const revision = $derived(machineStatus.current?.config?.revision)
	const partConfig = usePartConfig()
	const environment = useEnvironment()
	const { updateUUIDs } = usePersistentUUIDs()

	$effect.pre(() => {
		if (revision) {
			untrack(() => query.refetch())
		}
	})

	$effect(() => {
		if (query.isFetching) {
			logs.add('Fetching frames...')
		} else if (query.error) {
			logs.add(`Frames: ${query.error.message}`, 'error')
		}
	})

	$effect.pre(() => {
		if (partConfig.isDirty) {
			environment.current.viewerMode = 'edit'
		} else {
			environment.current.viewerMode = 'monitor'
		}
	})

	$effect.pre(() => {
		const entities: Entity[] = []

		for (const { frame } of query.data ?? []) {
			if (frame === undefined) {
				continue
			}

			const name = frame.referenceFrame
			const resourceName = resourceByName.current[frame.referenceFrame]
			const color = resourceNameToColor(resourceName)

			const entity = world.spawn(
				traits.UUID,
				traits.Name(name),
				traits.Parent(frame.poseInObserverFrame?.referenceFrame),
				traits.Pose(frame.poseInObserverFrame?.pose),
				traits.FramesAPI,
				traits.ReferenceFrame
			)

			if (color) {
				entity.add(traits.Color(color))
			}

			if (frame.physicalObject?.center) {
				entity.add(traits.Center(frame.physicalObject.center))
			}

			if (frame.physicalObject?.geometryType.case === 'box') {
				entity.add(traits.Box(createBox(frame.physicalObject.geometryType.value)))
			} else if (frame.physicalObject?.geometryType.case === 'capsule') {
				entity.add(traits.Capsule(createCapsule(frame.physicalObject.geometryType.value)))
			} else if (frame.physicalObject?.geometryType.case === 'sphere') {
				entity.add(traits.Sphere(createSphere(frame.physicalObject.geometryType.value)))
			} else if (frame.physicalObject?.geometryType.case === 'mesh') {
				entity.add(
					traits.BufferGeometry(parsePlyInput(frame.physicalObject.geometryType.value.mesh))
				)
			}

			entities.push(entity)
		}

		updateUUIDs(entities)

		return () => {
			for (const entity of entities) {
				entity.destroy()
			}
		}
	})

	const machineFrames = $derived.by(() => {
		const objects: Record<string, WorldObject> = {}

		for (const { frame } of query.data ?? []) {
			if (frame === undefined) {
				continue
			}

			const resourceName = resourceByName.current[frame.referenceFrame]
			const frameName = frame.referenceFrame ? frame.referenceFrame : 'Unnamed frame'
			const color = resourceNameToColor(resourceName)

			objects[frameName] = new WorldObject(
				frameName,
				frame.poseInObserverFrame?.pose,
				frame.poseInObserverFrame?.referenceFrame,
				frame.physicalObject,
				color ? { color } : undefined
			)
		}

		return objects
	})

	const [configFrames, configUnsetFrames] = $derived.by(() => {
		const components = (partConfig.localPartConfig.toJson() as unknown as PartConfig).components

		const objects: WorldObject[] = []
		const unsetObjects: string[] = []

		// deal with part defined frame config
		for (const component of components ?? []) {
			if (!component.frame) {
				unsetObjects.push(component.name)
				continue
			}

			const pose = createPoseFromFrame(component.frame)
			const geometry = createGeometryFromFrame(component.frame)
			const worldObject = new WorldObject(component.name, pose, component.frame.parent, geometry)
			objects.push(worldObject)
		}

		return [objects, unsetObjects]
	})

	const [fragmentFrames, fragmentUnsetFrames] = $derived.by(() => {
		const { fragment_mods: fragmentMods = [] } =
			(partConfig.localPartConfig.toJson() as unknown as PartConfig) ?? {}
		const fragmentDefinedComponents = Object.keys(partConfig.componentNameToFragmentId)
		const objects: WorldObject[] = []
		const unsetObjects: string[] = []

		// deal with fragment defined components
		for (const fragmentComponentName of fragmentDefinedComponents || []) {
			const fragmentId = partConfig.componentNameToFragmentId[fragmentComponentName]
			const fragmentMod = fragmentMods?.find((mod) => mod.fragment_id === fragmentId)

			if (!fragmentMod) {
				continue
			}

			const setComponentModIndex = fragmentMod.mods.findLastIndex(
				(mod) => mod['$set']?.[`components.${fragmentComponentName}.frame`] !== undefined
			)
			const unsetComponentModIndex = fragmentMod.mods.findLastIndex(
				(mod) => mod['$unset']?.[`components.${fragmentComponentName}.frame`] !== undefined
			)

			if (setComponentModIndex < unsetComponentModIndex) {
				unsetObjects.push(fragmentComponentName)
			} else if (unsetComponentModIndex < setComponentModIndex) {
				const frameData = fragmentMod.mods[setComponentModIndex]['$set'][
					`components.${fragmentComponentName}.frame`
				] as Frame
				const pose = createPoseFromFrame(frameData)
				const geometry = createGeometryFromFrame(frameData)
				const worldObject = new WorldObject(fragmentComponentName, pose, frameData.parent, geometry)
				objects.push(worldObject)
			}
		}
		return [objects, unsetObjects]
	})

	$effect.pre(() => {
		for (const frame of configFrames) {
			const result = machineFrames[frame.name]

			if (result) {
				result.referenceFrame = frame.referenceFrame
				result.localEditedPose = frame.pose
				result.geometry = frame.geometry
			} else {
				machineFrames[frame.name] = frame
			}
		}
	})

	$effect.pre(() => {
		for (const frame of fragmentFrames) {
			const result = machineFrames[frame.name]

			if (result) {
				result.referenceFrame = frame.referenceFrame
				result.localEditedPose = frame.pose
				result.geometry = frame.geometry
			} else {
				machineFrames[frame.name] = frame
			}
		}
	})

	$effect.pre(() => {
		for (const name of configUnsetFrames) {
			delete machineFrames[name]
		}
	})

	$effect.pre(() => {
		for (const name of fragmentUnsetFrames) {
			delete machineFrames[name]
		}
	})

	const current = $derived.by(() => {
		// eslint-disable-next-line @typescript-eslint/no-unused-vars
		const _configFrames = configFrames
		// eslint-disable-next-line @typescript-eslint/no-unused-vars
		const _fragmentFrames = fragmentFrames
		const results = Object.values(machineFrames)
		// updateUUIDs(results)
		return results
	})

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
	})
}

export const useFrames = (): FramesContext => {
	return getContext<FramesContext>(key)
}
