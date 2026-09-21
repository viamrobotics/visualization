import { Transform } from '@viamrobotics/sdk'
import { getContext, setContext } from 'svelte'

import type { Frame } from '$lib/frame'

import { createTransformFromFrame } from '$lib/frame'
import { mergedComponentFrames, resolveComponentFrames } from '$lib/resolveComponentFrames'

import { useFragmentInfo } from './useFragmentInfo.svelte'
import { usePartConfig } from './usePartConfig.svelte'

const key = Symbol('config-frames-context')

interface ConfigFramesContext {
	/**
	 * Frames the part config itself declares: a component's own `frame`, and a
	 * `fragment_mods` `$set` of a whole frame. Every frame edit writes one of
	 * those two, so these carry the user's unsaved edits.
	 */
	current: Record<string, Transform>
	/**
	 * Frames the fragments supply, rebuilt from each fragment's own frame and the
	 * part's `fragment_mods` patches beneath it. Resolution happens here rather
	 * than on the server, so a rebuilt pose can differ from the one the machine
	 * resolved. Use these for a component the machine reports no frame for.
	 */
	fragmentFrames: Record<string, Transform>
	/**
	 * The frame each component resolves to once the part's `fragment_mods` apply,
	 * which is what a variable lock compares against the fragment's own frame.
	 */
	effectiveFrames: Map<string, Frame>
	unsetFrames: string[]
	/**
	 * Components the part's `fragment_mods` patch a frame field on, without the
	 * app ever seeing the frame being patched, which is what a fragment that
	 * failed to resolve leaves behind. The component is framed, so it is not
	 * frameless, but its pose has to come from the machine.
	 */
	unresolvedFrames: ReadonlySet<string>
}

const toTransforms = (frames: Map<string, Frame>): Record<string, Transform> => {
	const results: Record<string, Transform> = {}

	for (const [name, frame] of frames) {
		results[name] = createTransformFromFrame(name, frame)
	}

	return results
}

export const provideConfigFrames = () => {
	const partConfig = usePartConfig()
	const fragmentInfo = useFragmentInfo()

	const resolved = $derived(resolveComponentFrames(partConfig.current, fragmentInfo.current ?? {}))

	const frames = $derived(toTransforms(resolved.frames))
	const fragmentFrames = $derived(toTransforms(resolved.fragmentFrames))
	const effectiveFrames = $derived(mergedComponentFrames(resolved))
	const unsetFrames = $derived([...resolved.unsetFrameNames])

	setContext<ConfigFramesContext>(key, {
		get current() {
			return frames
		},
		get fragmentFrames() {
			return fragmentFrames
		},
		get effectiveFrames() {
			return effectiveFrames
		},
		get unsetFrames() {
			return unsetFrames
		},
		get unresolvedFrames() {
			return resolved.unresolvedFrameNames
		},
	})
}

export const useConfigFrames = (): ConfigFramesContext => {
	return getContext<ConfigFramesContext>(key)
}
