import type { Intersection } from 'three'

import { useMouseRaycaster } from '$lib/hooks/useMouseRaycaster.svelte'

import { GizmoModes } from './gizmos'
import { useGizmos } from './useGizmos.svelte'

interface Options<Hit> {
	findHit: (intersections: Intersection[]) => Hit | undefined
	onPlace: (hit: Hit) => void
}

/**
 * The single-click placement pipeline shared by every gizmo tool: tracks the
 * pointer's current hit for the caller to render a cursor at, and fires
 * `onPlace` when the user clicks a usable one.
 *
 * The raycaster is only live while a tool is armed. Wiring it to `enabled: true`
 * unconditionally would raycast on every pointer move while the plugin is idle.
 */
export const usePlace = <Hit>(options: () => Options<Hit>) => {
	const gizmos = useGizmos()

	const { onclick, onmove, raycaster } = useMouseRaycaster(() => ({
		enabled: gizmos.mode !== GizmoModes.Idle,
	}))
	raycaster.firstHitOnly = true

	let hit = $state.raw<Hit>()

	onmove((event) => (hit = options().findHit(event.intersections)))
	onclick((event) => {
		const next = options().findHit(event.intersections)
		if (next === undefined) return

		options().onPlace(next)
	})

	return {
		get current() {
			return hit
		},
	}
}
