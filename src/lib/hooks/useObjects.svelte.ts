import { getContext, setContext } from 'svelte'

import type { Entity } from 'koota'
import { useWorld } from '$lib/ecs'

const key = Symbol('objects-context')

interface Context {
	current: Entity[]
}

export const provideObjects = () => {
	const world = useWorld()

	const entities = world.query()

	setContext<Context>(key, {
		get current() {
			return entities as Entity[]
		},
	})
}

export const useObjects = (): Context => {
	return getContext<Context>(key)
}
