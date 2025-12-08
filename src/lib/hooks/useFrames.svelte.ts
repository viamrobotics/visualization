import { getContext, setContext, untrack } from 'svelte'
import { Transform } from '@viamrobotics/sdk'
import { useRobotClient, createRobotQuery, useMachineStatus } from '@viamrobotics/svelte-sdk'
import { trait, type Entity } from 'koota'
import { useLogs } from './useLogs.svelte'
import { resourceNameToColor } from '$lib/color'
import { createTransformFromFrame, type Frame } from '$lib/frame'
import { usePartConfig, type PartConfig } from './usePartConfig.svelte'
import { useEnvironment } from './useEnvironment.svelte'
import { createPose } from '$lib/transform'
import { createBox, createCapsule, createSphere } from '$lib/geometry'
import { useResourceByName } from './useResourceByName.svelte'
import { traits, useWorld } from '$lib/ecs'
import { parsePlyInput } from '$lib/ply'

interface FramesContext {
	current: Transform[]
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

	$effect(() => {
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

	$effect(() => {
		if (partConfig.isDirty) {
			environment.current.viewerMode = 'edit'
		} else {
			environment.current.viewerMode = 'monitor'
		}
	})

	const machineFrames = $derived.by(() => {
		const frames: Record<string, Transform> = {}

		for (const { frame } of query.data ?? []) {
			if (frame === undefined) {
				continue
			}

			frames[frame.referenceFrame] = frame
		}

		return frames
	})

	const [configFrames, configUnsetFrameNames] = $derived.by(() => {
		const components = (partConfig.localPartConfig.toJson() as unknown as PartConfig).components

		const results: Record<string, Transform> = {}
		const unsetResults: string[] = []

		for (const { name, frame } of components ?? []) {
			if (!frame) {
				unsetResults.push(name)
				continue
			}

			results[name] = createTransformFromFrame(name, frame)
		}

		return [results, unsetResults]
	})

	const [fragmentFrames, fragmentUnsetFrameNames] = $derived.by(() => {
		const { fragment_mods: fragmentMods = [] } =
			(partConfig.localPartConfig.toJson() as unknown as PartConfig) ?? {}
		const fragmentDefinedComponents = Object.keys(partConfig.componentNameToFragmentId)

		const results: Record<string, Transform> = {}
		const unsetResults: string[] = []

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
				unsetResults.push(fragmentComponentName)
			} else if (unsetComponentModIndex < setComponentModIndex) {
				const frameData = fragmentMod.mods[setComponentModIndex]['$set'][
					`components.${fragmentComponentName}.frame`
				] as Frame
				results[fragmentComponentName] = createTransformFromFrame(fragmentComponentName, frameData)
			}
		}
		return [results, unsetResults]
	})

	const frames = $derived.by(() => {
		const result = {
			...machineFrames,
			...configFrames,
			...fragmentFrames,
		}

		// Remove frames that have just been deleted locally for optimistic updates
		for (const name of configUnsetFrameNames) {
			delete result[name]
		}

		// Remove frames that have been removed by fragment overrides
		for (const name of fragmentUnsetFrameNames) {
			delete result[name]
		}

		return result
	})

	const current = $derived(Object.values(frames))

	const entities = new Map<string, Entity | undefined>()

	$effect.pre(() => {
		for (const [name, entity] of entities) {
			if (!frames[name]) {
				entity?.destroy()
				entities.delete(name)
			}
		}

		for (const frame of current) {
			if (frame === undefined) {
				continue
			}

			const name = frame.referenceFrame
			const parent = frame.poseInObserverFrame?.referenceFrame ?? 'world'
			const pose = createPose(frame.poseInObserverFrame?.pose)
			const center = frame.physicalObject?.center
				? createPose(frame.physicalObject.center)
				: undefined
			const resourceName = resourceByName.current[frame.referenceFrame]
			const color = resourceNameToColor(resourceName)

			const existing = entities.get(name)

			if (existing) {
				existing.set(traits.Parent, parent)
				existing.set(traits.Pose, pose)

				if (color) {
					existing.set(traits.Color, color)
				}

				if (center) {
					existing.set(traits.Center, center)
				}

				continue
			}

			const geometryTrait = () => {
				if (frame.physicalObject?.geometryType.case === 'box') {
					return traits.Box(createBox(frame.physicalObject.geometryType.value))
				} else if (frame.physicalObject?.geometryType.case === 'capsule') {
					return traits.Capsule(createCapsule(frame.physicalObject.geometryType.value))
				} else if (frame.physicalObject?.geometryType.case === 'sphere') {
					return traits.Sphere(createSphere(frame.physicalObject.geometryType.value))
				} else if (frame.physicalObject?.geometryType.case === 'mesh') {
					return traits.BufferGeometry(parsePlyInput(frame.physicalObject.geometryType.value.mesh))
				}

				return trait()
			}

			const entity = world.spawn(
				traits.UUID,
				traits.Name(name),
				traits.Parent(parent),
				traits.Pose(pose),
				traits.Color(color ? color : undefined),
				center ? traits.Center(center) : trait(),
				geometryTrait(),
				traits.FramesAPI,
				traits.ReferenceFrame
			)

			entities.set(name, entity)
		}
	})

	const getParentFrameOptions = (componentName: string) => {
		const validFrames = new Set(current.map((frame) => frame.referenceFrame))
		validFrames.add('world')

		const frameNameQueue = [componentName]
		while (frameNameQueue.length > 0) {
			const frameName = frameNameQueue.shift()
			if (frameName) {
				validFrames.delete(frameName)
				const frames = current.filter((frame) => frame.referenceFrame === frameName)
				for (const frame of frames) {
					frameNameQueue.push(frame.referenceFrame)
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
