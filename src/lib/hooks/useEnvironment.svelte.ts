import { getContext, onDestroy, setContext } from 'svelte'
import { SvelteMap } from 'svelte/reactivity'

import { createStoredState } from './usePersistedStates.svelte'

export const ENVIRONMENT_CONTEXT_KEY = Symbol('environment')

/**
 * What the app is being used for right now. Every mode is contributed by a
 * plugin — `monitor` by `Monitor`, `build` by `BuildFrames`, `move` by
 * `MoveFrame`, `replay` by `MotionPlanReplayer` — and each owns its own
 * details panel and scene affordances.
 * With no mode plugins mounted the mode is `none`: a bare renderer.
 */
export type EnvironmentMode = 'monitor' | 'build' | 'move' | 'replay'

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

/** What leaving a mode would throw away, and how to throw it away. */
export interface LeaveConfirmation {
	/** Shown in the confirmation dialog, such as "Your unsaved frame edits will be discarded." */
	description: string
	/** Called when the user confirms, before the mode switches. */
	discard: () => void
}

export interface ModeOptions {
	/**
	 * Asked before switching away from the mode. Returns a confirmation while leaving would lose
	 * something, and `undefined` while it is safe to leave.
	 */
	confirmLeave?: () => LeaveConfirmation | undefined
	/**
	 * The mode shows its own details panel for the selection, so the visualizer leaves out the
	 * one it shows otherwise.
	 */
	ownsDetails?: boolean
}

export interface EnvironmentContext {
	current: Environment
	/**
	 * Declares `mode` reachable for as long as the caller is mounted, and returns
	 * the matching release function.
	 */
	registerMode: (mode: EnvironmentMode, options?: ModeOptions) => () => void
	/**
	 * What switching away from the active mode would lose, from the first of its registrations
	 * that reports anything. `undefined` when the switch loses nothing.
	 */
	leaveConfirmation: () => LeaveConfirmation | undefined
	/** Whether the active mode shows its own details panel. See `ModeOptions.ownsDetails`. */
	readonly modeOwnsDetails: boolean
	/**
	 * Every mode currently reachable, in registration order. Order is priority:
	 * the first entry is the fallback when the stored mode is unreachable. Empty
	 * when no mode plugins are mounted.
	 */
	readonly availableModes: EnvironmentMode[]
}

/** Where the persisted mode lives, after the visualizer's `storageKey` prefix. */
export const ENVIRONMENT_MODE_STORAGE_KEY = 'environment-mode'

const modes = new Set(['monitor', 'build', 'move', 'replay'])

/** Whether `value` names one of the closed set of modes. */
export const isEnvironmentMode = (value: string): value is EnvironmentMode => modes.has(value)

/** The mode persists under `<storageKey>:environment-mode`, or in memory without a key. */
export const createEnvironment = (storageKey?: string): EnvironmentContext => {
	const stored = createStoredState<EnvironmentMode | 'none'>(
		storageKey,
		ENVIRONMENT_MODE_STORAGE_KEY,
		'monitor'
	)
	const availableModes = new SvelteMap<EnvironmentMode, number>()
	// Read only when a switch is requested, so it needs no reactivity.
	const leaveGuards = new Map<EnvironmentMode, Set<NonNullable<ModeOptions['confirmLeave']>>>()
	// Registrations that own the details panel, per mode. Counted, like `availableModes`.
	const detailsOwners = new SvelteMap<EnvironmentMode, number>()

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
		get modeOwnsDetails() {
			const mode = effectiveMode
			return mode !== 'none' && detailsOwners.has(mode)
		},
		leaveConfirmation() {
			const mode = effectiveMode
			if (mode === 'none') return undefined

			for (const confirmLeave of leaveGuards.get(mode) ?? []) {
				const confirmation = confirmLeave()
				if (confirmation) return confirmation
			}

			return undefined
		},
		registerMode(mode, options) {
			availableModes.set(mode, (availableModes.get(mode) ?? 0) + 1)

			const guard = options?.confirmLeave
			// Wrapped so registering the same function twice still yields two entries to release.
			const confirmLeave = guard && (() => guard())
			if (confirmLeave) {
				const guards = leaveGuards.get(mode) ?? new Set()
				guards.add(confirmLeave)
				leaveGuards.set(mode, guards)
			}

			const ownsDetails = options?.ownsDetails === true
			if (ownsDetails) detailsOwners.set(mode, (detailsOwners.get(mode) ?? 0) + 1)

			let released = false
			return () => {
				if (released) return
				released = true

				if (confirmLeave) leaveGuards.get(mode)?.delete(confirmLeave)

				if (ownsDetails) {
					const owners = (detailsOwners.get(mode) ?? 1) - 1
					if (owners > 0) {
						detailsOwners.set(mode, owners)
					} else {
						detailsOwners.delete(mode)
					}
				}

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

export const provideEnvironment = (storageKey: string | undefined) => {
	const context = createEnvironment(storageKey)
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
 * `options.confirmLeave` lets the mode ask the user before a switch away throws its work out.
 */
export const useEnvironmentMode = (mode: EnvironmentMode, options?: ModeOptions) => {
	const release = useEnvironment().registerMode(mode, options)
	onDestroy(release)
}
