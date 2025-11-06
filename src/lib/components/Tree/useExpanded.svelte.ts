import { get, set } from 'idb-keyval'
import { getContext, setContext } from 'svelte'
import { SvelteSet } from 'svelte/reactivity'

const key = Symbol('tree-item-expanded-context')

type Context = SvelteSet<string>

export const provideTreeExpandedContext = () => {
	const expanded = new SvelteSet<string>()

	get('tree-item-expanded').then((stored) => {
		if (stored) {
			for (const value of stored) {
				expanded.add(value)
			}
		}
	})

	$effect(() => {
		set('tree-item-expanded', [...expanded])
	})

	setContext<Context>(key, expanded)
}

export const useExpanded = (): Context => {
	return getContext<Context>(key)
}
