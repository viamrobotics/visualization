import { get, set } from 'idb-keyval'
import { getContext, setContext } from 'svelte'
import { SvelteMap } from 'svelte/reactivity'

const key = Symbol('object-visibility-context')
const idbKey = 'object-visibility'

type Context = SvelteMap<string, boolean>

export const provideVisibility = () => {
	const map = new SvelteMap<string, boolean>()

	get(idbKey).then((entries) => {
		if (entries) {
			for (const [key, value] of entries) {
				map.set(key, value)
			}
		}
	})

	$effect(() => {
		set(idbKey, [...map.entries()])
	})

	setContext<Context>(key, map)
}

export const useVisibility = (): Context => {
	return getContext<Context>(key)
}
