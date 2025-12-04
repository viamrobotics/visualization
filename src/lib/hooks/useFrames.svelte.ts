import { getContext, setContext, untrack } from 'svelte'
import { Transform } from '@viamrobotics/sdk'
import { useRobotClient, createRobotQuery, useMachineStatus } from '@viamrobotics/svelte-sdk'
import { WorldObject } from '$lib/WorldObject.svelte'
import { useLogs } from './useLogs.svelte'
import { resourceNameToColor } from '$lib/color'
import { createTransformFromFrame, type Frame } from '$lib/frame'
import { usePartConfig, type PartConfig } from './usePartConfig.svelte'
import { useEnvironment } from './useEnvironment.svelte'
import { useResourceByName } from './useResourceByName.svelte'
import { usePersistentUUIDs } from './usePersistentUUIDs.svelte'

interface FramesContext {
	current: WorldObject[]
	getParentFrameOptions: (componentName: string) => string[]
}

const key = Symbol('frames-context')

export const provideFrames = (partID: () => string) => {
	const resourceByName = useResourceByName()
	const client = useRobotClient(partID)
	const machineStatus = useMachineStatus(partID)
	const logs = useLogs()
	const query = createRobotQuery(client, 'frameSystemConfig')
	const revision = $derived(machineStatus.current?.config?.revision)
	const partConfig = usePartConfig()
	const environment = useEnvironment()
	const { updateUUIDs } = usePersistentUUIDs()

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

		for (const name of configUnsetFrameNames) {
			delete result[name]
		}

		for (const name of fragmentUnsetFrameNames) {
			delete result[name]
		}

		return result
	})

	const current = $derived.by(() => {
		const results: WorldObject[] = []

		for (const frame of Object.values(frames)) {
			const resourceName = resourceByName.current[frame.referenceFrame]
			const frameName = frame.referenceFrame ? frame.referenceFrame : 'Unnamed frame'
			const color = resourceNameToColor(resourceName)

			results.push(
				new WorldObject(
					frameName,
					frame.poseInObserverFrame?.pose,
					frame.poseInObserverFrame?.referenceFrame,
					frame.physicalObject,
					color ? { color } : undefined
				)
			)
		}

		updateUUIDs(results)

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
