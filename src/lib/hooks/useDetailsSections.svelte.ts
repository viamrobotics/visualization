import type { Entity } from 'koota'
import type { Snippet } from 'svelte'

import { getContext, onDestroy, setContext } from 'svelte'
import { SvelteSet } from 'svelte/reactivity'

export const DETAILS_SECTIONS_CONTEXT_KEY = Symbol('details-sections')

/** Which of a details card's tabs a section renders into. */
export type DetailsTabId = 'details' | 'appearance'

export interface DetailsSection {
	/**
	 * Rendered once inside the details panel with every selected entity, when `when`
	 * holds for all of them. A section edits or shows the selection as a whole.
	 */
	snippet: Snippet<[{ entities: readonly Entity[] }]>
	/**
	 * Names the section in the notice shown when `when` holds for only part of the
	 * selection, such as `sensor coverage`.
	 */
	label: string
	/**
	 * Per-entity gate. Holding for every selected entity renders the section, for some
	 * renders a notice in its place, and for none leaves it out. Omitted = every entity.
	 */
	when?: (entity: Entity) => boolean
	/**
	 * Where the section lands. Defaults to `details`, the tab that carries pose,
	 * dimensions, and relationships. Use `appearance` for a control over how the
	 * entity is drawn, beside colour and opacity.
	 */
	tab?: DetailsTabId
}

/** The default tab, applied to a section that names none. */
const DEFAULT_TAB: DetailsTabId = 'details'

/** The sections belonging to `tab`, in registration order. */
export const sectionsForTab = (
	sections: readonly DetailsSection[],
	tab: DetailsTabId
): DetailsSection[] => sections.filter((section) => (section.tab ?? DEFAULT_TAB) === tab)

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
