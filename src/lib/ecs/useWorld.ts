import { createWorld, type World } from 'koota'
import { getContext, setContext } from 'svelte'

const key = Symbol('koota-context')

export function provideWorld() {
	console.log('hi')
	const world = createWorld()
	console.log(world)

	setContext<World>(key, world)
}

export function useWorld() {
	return getContext<World>(key)
}
