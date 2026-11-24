import type { Attachment } from 'svelte/attachments'

import { getContext, setContext } from 'svelte'
import { SvelteMap } from 'svelte/reactivity'

/**
 * Moves the element into `target`, `document.body` by default. Only the DOM moves: the component
 * that rendered the element still owns it, so everything inside keeps that component's context.
 */
export const domPortal = (target?: HTMLElement): Attachment => {
	return (element) => {
		const finalTarget = target ?? document.body
		finalTarget.append(element)

		return () => {
			element.remove()
		}
	}
}

const key = Symbol('dom-portals')

interface DomPortals {
	/** The element `<DomPortalTarget {id}>` renders, once it has mounted. */
	get: (id: string) => HTMLElement | undefined
	/** Makes `element` the target for `id` until the returned release runs. */
	register: (id: string, element: HTMLElement) => () => void
}

/** The targets `<DomPortal>` content is moved into, keyed by id. */
export const provideDomPortals = (): void => {
	const targets = new SvelteMap<string, HTMLElement>()

	setContext<DomPortals>(key, {
		get: (id) => targets.get(id),
		register(id, element) {
			targets.set(id, element)
			return () => {
				if (targets.get(id) === element) targets.delete(id)
			}
		},
	})
}

export const useDomPortals = (): DomPortals => getContext<DomPortals>(key)
