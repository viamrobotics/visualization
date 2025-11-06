import { getContext, setContext } from 'svelte'
import type { Vector3, Vector3Tuple } from 'three'

const key = Symbol('origin-context')

interface Context {
	position: Vector3Tuple
	rotation: number
	set: (pos?: Vector3, rot?: number) => void
}

export const provideOrigin = () => {
	const position = $state<Vector3Tuple>([0, 0, 0])
	let rotation = $state(0)

	setContext<Context>(key, {
		get position() {
			return position
		},
		get rotation() {
			return rotation
		},
		set(pos?: Vector3, rot?: number) {
			if (pos) {
				position[0] = pos.x
				position[1] = pos.y
				position[2] = pos.z
			}

			if (rot) {
				rotation = rot
			}
		},
	})
}

export const useOrigin = () => {
	return getContext<Context>(key)
}
