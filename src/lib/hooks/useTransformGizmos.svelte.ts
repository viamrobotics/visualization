import { getContext, onDestroy, setContext } from 'svelte'
import { SvelteSet } from 'svelte/reactivity'

export const TRANSFORM_GIZMOS_CONTEXT_KEY = Symbol('transform-gizmos')

export type TransformGizmoMode = 'none' | 'rotate' | 'scale' | 'translate'

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
 */
export const provideTransformGizmos = () => {
	const gizmos = new SvelteSet<TransformGizmo>()

	const availableModes = $derived(new Set([...gizmos].flatMap((gizmo) => gizmo.modes())))

	setContext<Context>(TRANSFORM_GIZMOS_CONTEXT_KEY, {
		get availableModes() {
			return availableModes
		},
		select(mode) {
			for (const gizmo of gizmos) {
				if (gizmo.modes().includes(mode)) {
					gizmo.select(mode)
				}
			}
		},
		register(gizmo) {
			gizmos.add(gizmo)
			return () => gizmos.delete(gizmo)
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
