import { parentFrameOptions } from '#lib/parentFrameOptions.js'

import { useConfigFrames } from './useConfigFrames.svelte'
import { useFragmentInfo } from './useFragmentInfo.svelte'
import { useFrames } from './useFrames.svelte'

/**
 * Reactive list of frames every named frame may be reparented to: the parents they
 * have in common, so one pick never makes any of them its own ancestor.
 *
 * Sourced from `useFrames` — the machine's frame system merged with the part
 * config — rather than the part config alone. Components a fragment provides
 * never appear in `partConfig.components`, and components on remote parts never
 * appear in this part's config at all, so a config-only list silently omits
 * frames that are perfectly valid parents.
 */
export const useParentFrameOptions = (
	componentNames: () => readonly (string | undefined)[]
): { readonly current: string[] } => {
	const frames = useFrames()
	const configFrames = useConfigFrames()
	const fragmentInfo = useFragmentInfo()

	// A fragment frame with no `parent` is world-parented, the same default
	// `createTransformFromFrame` applies. No frame at all means no known parent.
	const fragmentComponents = $derived(
		Object.entries(fragmentInfo.current).map(([name, info]) => ({
			name,
			parent: info.frame ? (info.frame.parent ?? 'world') : undefined,
		}))
	)

	const current = $derived.by(() => {
		const [first, ...rest] = componentNames().map((componentName) =>
			parentFrameOptions({
				frames: frames.current,
				fragmentComponents,
				unsetFrameNames: configFrames.unsetFrames,
				componentName,
			})
		)
		if (!first) return []

		const allowedByRest = rest.map((options) => new Set(options))
		return first.filter((option) => allowedByRest.every((allowed) => allowed.has(option)))
	})

	return {
		get current() {
			return current
		},
	}
}
