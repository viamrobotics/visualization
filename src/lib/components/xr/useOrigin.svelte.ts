import type { Vector3Tuple } from 'three'

import { getContext, setContext } from 'svelte'

const key = Symbol('origin-context')

interface Context {
	position: Vector3Tuple
	rotation: number
	set: (pos?: Vector3Tuple, rot?: number) => void
	/** Request persistence of the current origin (creates/updates the XR anchor). */
	commit: () => void
	/** Called once by OriginMarker to wire the commit implementation. */
	registerCommit: (fn: () => void) => void
}

export const provideOrigin = () => {
	const position = $state<Vector3Tuple>([0, 0, 0])
	let rotation = $state(0)
	let commitFn: () => void = () => {}

	setContext<Context>(key, {
		get position() {
			return position
		},
		get rotation() {
			return rotation
		},
		set(pos?: Vector3Tuple, rot?: number) {
			if (pos) {
				position[0] = pos[0]
				position[1] = pos[1]
				position[2] = pos[2]
			}

			if (rot !== undefined) {
				rotation = rot
			}
		},
		commit() {
			commitFn()
		},
		registerCommit(fn: () => void) {
			commitFn = fn
		},
	})
}

export const useOrigin = () => {
	return getContext<Context>(key)
}
