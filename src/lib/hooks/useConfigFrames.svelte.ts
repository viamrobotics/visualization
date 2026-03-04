import { useEnvironment } from './useEnvironment.svelte'
import { usePartConfig } from './usePartConfig.svelte'
import { createTransformFromFrame, type Frame } from '$lib/frame'

import { Transform } from '@viamrobotics/sdk'
import { getContext, setContext } from 'svelte'

const key = Symbol('config-frames-context')

interface ConfigFramesContext {
	unsetFrames: string[]
	current: Record<string, Transform>
	getParentFrameOptions: (componentName: string) => string[]
}

export const provideConfigFrames = () => {
	const environment = useEnvironment()
	const partConfig = usePartConfig()

	$effect(() => {
		if (partConfig.isDirty) {
			environment.current.viewerMode = 'edit'
		} else {
			environment.current.viewerMode = 'monitor'
		}
	})

	const [configFrames, configUnsetFrameNames] = $derived.by(() => {
		const { components } = partConfig.current

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
		const { fragment_mods: fragmentMods = [] } = partConfig.current
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
			...configFrames,
			...fragmentFrames,
		}

		return result
	})

	const frameValues = $derived(Object.values(frames))

	const getParentFrameOptions = (componentName: string) => {
		const validFrames = new Set(frameValues.map((frame) => frame.referenceFrame))
		validFrames.add('world')

		const frameNameQueue = [componentName]
		while (frameNameQueue.length > 0) {
			const frameName = frameNameQueue.shift()
			if (frameName) {
				validFrames.delete(frameName)
				const filteredFrames = frameValues.filter(
					(frame) => frame.poseInObserverFrame?.referenceFrame === frameName
				)
				for (const frame of filteredFrames) {
					frameNameQueue.push(frame.referenceFrame)
				}
			}
		}

		return Array.from(validFrames)
	}

	const unsetFrames = $derived([...new Set([...configUnsetFrameNames, ...fragmentUnsetFrameNames])])

	setContext<ConfigFramesContext>(key, {
		getParentFrameOptions,
		get unsetFrames() {
			return unsetFrames
		},
		get current() {
			return frames
		},
	})
}

export const useConfigFrames = (): ConfigFramesContext => {
	return getContext<ConfigFramesContext>(key)
}
