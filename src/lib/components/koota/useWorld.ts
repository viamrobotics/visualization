import { createWorld, type World } from 'koota'
import { getContext, setContext } from 'svelte'

const key = Symbol('koota-context')

export function provideWorld() {
	const world = createWorld()

	setContext<World>(key, world)
}

export function useWorld() {
	return getContext<World>(key)
}
