import type { Vector3, Vector3Like, Vector3Tuple } from 'three'

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
	/**
	 * Convert a position reported in the composed XR reference space
	 * (zUp offset by the current origin) into the zUp frame that
	 * `position`/`rotation` are stored in. Writes into `out` and returns it.
	 */
	toZUpPos: (out: Vector3, p: Vector3Like) => Vector3
	/**
	 * Rotate a direction from the composed XR reference space into zUp
	 * (no translation). Mutates `v` in place and returns it.
	 */
	toZUpDir: (v: Vector3) => Vector3
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
		toZUpPos(out, p) {
			const cos = Math.cos(rotation)
			const sin = Math.sin(rotation)
			out.set(
				position[0] + cos * p.x - sin * p.y,
				position[1] + sin * p.x + cos * p.y,
				position[2] + p.z
			)
			return out
		},
		toZUpDir(v) {
			const cos = Math.cos(rotation)
			const sin = Math.sin(rotation)
			const x = v.x
			v.x = cos * x - sin * v.y
			v.y = sin * x + cos * v.y
			return v
		},
	})
}

export const useOrigin = () => {
	return getContext<Context>(key)
}
