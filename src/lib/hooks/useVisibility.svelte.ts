import type { Entity } from 'koota'
import { getContext, setContext } from 'svelte'
import { SvelteMap } from 'svelte/reactivity'

const key = Symbol('object-visibility-context')

type Context = SvelteMap<Entity, boolean>

export const provideVisibility = () => {
	const map = new SvelteMap<Entity, boolean>()

	setContext<Context>(key, map)
}

export const useVisibility = (): Context => {
	return getContext<Context>(key)
}
