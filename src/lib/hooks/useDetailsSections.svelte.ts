import type { Entity } from 'koota'
import type { Snippet } from 'svelte'

import { getContext, onDestroy, setContext } from 'svelte'
import { SvelteSet } from 'svelte/reactivity'

export const DETAILS_SECTIONS_CONTEXT_KEY = Symbol('details-sections')

export interface DetailsSection {
	/** Rendered inside every applicable details card, with that card's entity. */
	snippet: Snippet<[{ entity: Entity }]>
	/** Per-entity gate, checked when the card renders. Omitted = every card. */
	when?: (entity: Entity) => boolean
}

interface Context {
	/** Registered sections, in registration order — which is render order. */
	readonly current: DetailsSection[]
	/** Adds `section` and returns its release function. Identity-based — each registration stands alone. */
	register: (section: DetailsSection) => () => void
}

export const createDetailsSections = (): Context => {
	const sections = new SvelteSet<DetailsSection>()

	return {
		get current() {
			return [...sections]
		},
		register(section) {
			sections.add(section)

			let released = false
			return () => {
				if (released) return
				released = true

				sections.delete(section)
			}
		},
	}
}

export const provideDetailsSections = () => {
	const context = createDetailsSections()
	setContext<Context>(DETAILS_SECTIONS_CONTEXT_KEY, context)
	return context
}

export const useDetailsSections = () => {
	return getContext<Context>(DETAILS_SECTIONS_CONTEXT_KEY)
}

/**
 * Contributes a section to the details cards for as long as the calling
 * component is mounted. Cards are rendered by the mode plugins; while none is
 * mounted, sections are registered but have nowhere to appear.
 */
export const useDetailsSection = (section: DetailsSection) => {
	const release = useDetailsSections().register(section)
	onDestroy(release)
}
