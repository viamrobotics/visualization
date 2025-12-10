import { getContext, setContext, untrack } from 'svelte'
import { Transform } from '@viamrobotics/sdk'
import { useRobotClient, createRobotQuery, useMachineStatus } from '@viamrobotics/svelte-sdk'
import type { ConfigurableTrait, Entity } from 'koota'
import { useLogs } from './useLogs.svelte'
import { resourceNameToColor } from '$lib/color'
import { createTransformFromFrame, type Frame } from '$lib/frame'
import { usePartConfig, type PartConfig } from './usePartConfig.svelte'
import { useEnvironment } from './useEnvironment.svelte'
import { createPose } from '$lib/transform'
import { useResourceByName } from './useResourceByName.svelte'
import { traits, useWorld } from '$lib/ecs'

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
		for (const frame of current) {
			if (frame === undefined) {
				continue
			}

			const name = frame.referenceFrame
			const parent = frame.poseInObserverFrame?.referenceFrame
			const pose = createPose(frame.poseInObserverFrame?.pose)
			const center = frame.physicalObject?.center
				? createPose(frame.physicalObject.center)
				: undefined
			const resourceName = resourceByName.current[frame.referenceFrame]
			const color = resourceNameToColor(resourceName)
			console.log(color)

			const existing = entities.get(name)

			if (existing) {
				existing.set(traits.Pose, pose)

				if (!parent || parent === 'world') {
					existing.remove(traits.Parent)
				} else if (parent && existing.has(traits.Parent)) {
					existing.set(traits.Parent, parent)
				} else {
					existing.add(traits.Parent(parent))
				}

				if (color) {
					existing.set(traits.Color, color)
				}

				if (center) {
					existing.set(traits.Center, center)
				}

				if (frame.physicalObject) {
					existing.remove(traits.Box, traits.Sphere, traits.BufferGeometry, traits.Capsule)
					existing.add(traits.Geometry(frame.physicalObject))
				}

				continue
			}

			const entityTraits: ConfigurableTrait[] = [
				traits.Name(name),
				traits.Pose(pose),
				traits.EditedPose(pose),
				traits.FramesAPI,
			]

			if (parent && parent !== 'world') {
				entityTraits.push(traits.Parent(parent))
			}

			if (color) {
				entityTraits.push(traits.Color(color))
			}

			if (center) {
				entityTraits.push(traits.Center(center))
			}

			if (frame.physicalObject) {
				entityTraits.push(traits.Geometry(frame.physicalObject))
			}

			const entity = world.spawn(...entityTraits)

			entities.set(name, entity)
		}

		// Clean up non-active entities
		for (const [name, entity] of entities) {
			if (!frames[name]) {
				entity?.destroy()
				entities.delete(name)
			}
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
				const frames = current.filter(
					(frame) => frame.poseInObserverFrame?.referenceFrame === frameName
				)
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
