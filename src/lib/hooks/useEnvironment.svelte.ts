import { PersistedState } from 'runed'
import { getContext, onDestroy, setContext } from 'svelte'
import { SvelteMap } from 'svelte/reactivity'

export const ENVIRONMENT_CONTEXT_KEY = Symbol('environment')

/**
 * What the app is being used for right now. Every mode is contributed by a
 * plugin — `monitor` by `Monitor`, `build` by `BuildFrames`, `move` by
 * `MoveFrame` — and each owns its own details panel and scene affordances.
 * With no mode plugins mounted the mode is `none`: a bare renderer.
 */
export type EnvironmentMode = 'monitor' | 'build' | 'move'

interface Environment {
	/** The active mode. `none` when nothing reachable is contributed. */
	mode: EnvironmentMode | 'none'
	isStandalone: boolean
	inputBindingsEnabled: boolean
	/**
	 * Whether an immersive XR session owns the canvas. Published by the XR plugin
	 * so readers don't need `@threlte/xr`, which is an optional peer.
	 */
	isImmersive: boolean
}

export interface EnvironmentContext {
	current: Environment
	/**
	 * Declares `mode` reachable for as long as the caller is mounted, and returns
	 * the matching release function.
	 */
	registerMode: (mode: EnvironmentMode) => () => void
	/**
	 * Every mode currently reachable, in registration order. Order is priority:
	 * the first entry is the fallback when the stored mode is unreachable. Empty
	 * when no mode plugins are mounted.
	 */
	readonly availableModes: EnvironmentMode[]
}

/**
 * Where the persisted mode lives. Exported so tests can reset it. Kept as
 * `motion-tools:` after the rename to visualization so existing users keep their mode.
 */
export const ENVIRONMENT_MODE_STORAGE_KEY = 'motion-tools:environment-mode'

const modes = new Set(['monitor', 'build', 'move'])

/** Whether `value` names one of the closed set of modes. */
export const isEnvironmentMode = (value: string): value is EnvironmentMode => modes.has(value)

export const createEnvironment = (): EnvironmentContext => {
	const stored = new PersistedState<EnvironmentMode | 'none'>(
		ENVIRONMENT_MODE_STORAGE_KEY,
		'monitor'
	)
	const availableModes = new SvelteMap<EnvironmentMode, number>()

	const effectiveMode = $derived.by((): EnvironmentMode | 'none' => {
		const value = stored.current
		if (isEnvironmentMode(value) && availableModes.has(value)) {
			return value
		}
		return availableModes.keys().next().value ?? 'none'
	})

	const environment = $state<Environment>({
		get mode() {
			return effectiveMode
		},
		set mode(value) {
			stored.current = value
		},
		isStandalone: true,
		inputBindingsEnabled: true,
		isImmersive: false,
	})

	const context: EnvironmentContext = {
		get current() {
			return environment
		},
		get availableModes() {
			return [...availableModes.keys()]
		},
		registerMode(mode) {
			availableModes.set(mode, (availableModes.get(mode) ?? 0) + 1)

			let released = false
			return () => {
				if (released) return
				released = true

				const count = (availableModes.get(mode) ?? 1) - 1
				if (count > 0) {
					availableModes.set(mode, count)
				} else {
					availableModes.delete(mode)
				}
			}
		},
	}

	return context
}

export const provideEnvironment = () => {
	const context = createEnvironment()
	setContext<EnvironmentContext>(ENVIRONMENT_CONTEXT_KEY, context)
	return context
}

export const useEnvironment = () => {
	return getContext<EnvironmentContext>(ENVIRONMENT_CONTEXT_KEY)
}

/**
 * Declares `mode` reachable for as long as the calling component is mounted.
 * Plugins that contribute a mode call this in setup (synchronously), so the first
 * render already resolves the persisted mode instead of flashing the fallback.
 */
export const useEnvironmentMode = (mode: EnvironmentMode) => {
	const release = useEnvironment().registerMode(mode)
	onDestroy(release)
}
