import { getContext, onDestroy, setContext } from 'svelte'
import { SvelteSet } from 'svelte/reactivity'

import { useKeybindings } from '$lib/keybindings'

import { TRANSFORM_KEYBINDINGS } from './transformKeybindings'

export const TRANSFORM_GIZMOS_CONTEXT_KEY = Symbol('transform-gizmos')

export const TRANSFORM_MODES = ['none', 'translate', 'rotate', 'scale'] as const

export type TransformGizmoMode = (typeof TRANSFORM_MODES)[number]

export interface TransformGizmo {
	/** Modes this gizmo can switch to right now. Read at call time, so it may close over state. */
	modes: () => readonly TransformGizmoMode[]
	select: (mode: TransformGizmoMode) => void
}

interface Context {
	/** Every mode some mounted gizmo can honour. Empty when no gizmo is offering any. */
	readonly availableModes: ReadonlySet<TransformGizmoMode>
	/** Switches every gizmo that offers `mode` to it. */
	select: (mode: TransformGizmoMode) => void
	register: (gizmo: TransformGizmo) => () => void
}

/**
 * Lets the transform shortcuts ask what a gizmo can do instead of asking what mode the app
 * is in. Each gizmo publishes the modes it accepts while mounted, so a key selects a mode
 * when that would change something and stays inert otherwise.
 *
 * The shortcuts are registered here rather than by a gizmo, so the two gizmos cannot
 * collide over one key, and they exist only while some host has mounted a gizmo at all.
 */
export const provideTransformGizmos = () => {
	const gizmos = new SvelteSet<TransformGizmo>()
	const keybindings = useKeybindings()

	const availableModes = $derived(new Set([...gizmos].flatMap((gizmo) => gizmo.modes())))

	const select = (mode: TransformGizmoMode) => {
		for (const gizmo of gizmos) {
			if (gizmo.modes().includes(mode)) {
				gizmo.select(mode)
			}
		}
	}

	let releaseShortcuts: (() => void) | undefined

	const registerShortcuts = () => {
		const releases = TRANSFORM_MODES.map((mode) =>
			keybindings.register(TRANSFORM_KEYBINDINGS[mode], {
				when: () => availableModes.has(mode),
				run: () => select(mode),
			})
		)

		return () => {
			for (const release of releases) release()
		}
	}

	setContext<Context>(TRANSFORM_GIZMOS_CONTEXT_KEY, {
		get availableModes() {
			return availableModes
		},
		select,
		register(gizmo) {
			gizmos.add(gizmo)
			releaseShortcuts ??= registerShortcuts()

			return () => {
				gizmos.delete(gizmo)

				if (gizmos.size === 0) {
					releaseShortcuts?.()
					releaseShortcuts = undefined
				}
			}
		},
	})
}

export const useTransformGizmos = (): Context => {
	return getContext<Context>(TRANSFORM_GIZMOS_CONTEXT_KEY)
}

/** Publishes a gizmo's modes for as long as the calling component is mounted. */
export const useTransformGizmo = (gizmo: TransformGizmo) => {
	const release = useTransformGizmos().register(gizmo)
	onDestroy(release)
}
