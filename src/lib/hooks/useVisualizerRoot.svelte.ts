import { getContext, setContext } from 'svelte'

const key = Symbol('visualizer-root-context')

interface Context {
	/** The element the whole visualizer renders into. `undefined` until it mounts. */
	readonly current: HTMLElement | undefined
}

export const provideVisualizerRoot = (root: () => HTMLElement | undefined): Context => {
	const context: Context = {
		get current() {
			return root()
		},
	}

	setContext<Context>(key, context)

	return context
}

/**
 * The visualizer's root element, for a plugin that has to change how the whole visualizer sits
 * in the host page. Set inline styles on it, not classes: the visualizer owns its `class`.
 */
export const useVisualizerRoot = (): Context => getContext<Context>(key)
