import { getContext, setContext } from 'svelte'

const key = Symbol('root-context')

interface Context {
	rect: DOMRect
	current: HTMLElement | undefined
}

export const provideRoot = (root: () => HTMLElement | undefined) => {
	const el = $derived(root())

	let rect = $state.raw<DOMRect>(new DOMRect())

	const observer = new ResizeObserver(([entry]) => {
		console.log(entry)
		rect = entry.contentRect
	})

	$effect(() => {
		if (!el) return

		observer.observe(el)
		return () => observer.disconnect()
	})

	setContext<Context>(key, {
		get rect() {
			return rect
		},
		get current() {
			return el
		},
	})
}

export const useRoot = (): Context => {
	return getContext<Context>(key)
}
