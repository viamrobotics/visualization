import { createWorld, type World } from 'koota'
import { getContext, onDestroy, setContext } from 'svelte'

import * as relations from './relations'
import * as traits from './traits'

export const WORLD_CONTEXT_KEY = Symbol('koota-context')

export function provideWorld() {
	const world = createWorld()

	// @ts-expect-error This is for debugging.
	globalThis.__koota__ = {
		world,
		traits,
		relations,
	}

	setContext<World>(WORLD_CONTEXT_KEY, world)

	// Koota allows 16 live worlds on a page, so a scene that never freed its own would make the
	// seventeenth mount throw. Deferred a microtask: this teardown runs before the scene's children
	// run theirs, and they still destroy entities in this world.
	onDestroy(() => {
		queueMicrotask(() => world.destroy())
	})
}

export function useWorld() {
	return getContext<World>(WORLD_CONTEXT_KEY)
}
