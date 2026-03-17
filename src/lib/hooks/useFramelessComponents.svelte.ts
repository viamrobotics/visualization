import { getContext, setContext } from 'svelte'

import { useFrames } from './useFrames.svelte'
import { usePartConfig } from './usePartConfig.svelte'

interface FramelessComponents {
	current: string[]
}

const key = Symbol('frameless-components-context')

export const provideFramelessComponents = () => {
	const partConfig = usePartConfig()
	const frames = useFrames()

	const current = $derived.by(() => {
		const { components } = partConfig.current
		const partComponentsWIthNoFrame =
			components
				?.filter((component) => component.frame === undefined)
				.map((component) => component.name) ?? []
		const fragmentComponentsWithNoFrame = []
		for (const fragmentComponentName of Object.keys(partConfig.componentNameToFragmentId)) {
			if (frames.current.some((frame) => frame.referenceFrame === fragmentComponentName)) {
				continue
			}

			fragmentComponentsWithNoFrame.push(fragmentComponentName)
		}
		return [...partComponentsWIthNoFrame, ...fragmentComponentsWithNoFrame]
	})

	setContext<FramelessComponents>(key, {
		get current() {
			return current
		},
	})
}

export const useFramelessComponents = () => {
	return getContext<FramelessComponents>(key)
}
