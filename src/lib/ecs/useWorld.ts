import { createWorld, type World } from 'koota'
import { getContext, setContext } from 'svelte'

export const WORLD_CONTEXT_KEY = Symbol('koota-context')

export function provideWorld() {
	const world = createWorld()

	setContext<World>(WORLD_CONTEXT_KEY, world)
}

export function useWorld() {
	return getContext<World>(WORLD_CONTEXT_KEY)
}
