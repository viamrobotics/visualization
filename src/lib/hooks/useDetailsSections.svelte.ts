import type { Entity } from 'koota'

import { getContext, setContext } from 'svelte'
import { SvelteMap, SvelteSet } from 'svelte/reactivity'

export const DETAILS_SECTIONS_CONTEXT_KEY = Symbol('details-sections')

/**
 * Which of a details card's tabs a section renders into. `test` is a tab of its own that a mode
 * shows only while some section for it applies to the selection.
 */
export type DetailsTabId = 'details' | 'appearance' | 'test'

/** A section a `<DetailsSection>` has registered. Its content is rendered by that component. */
export interface RegisteredDetailsSection {
	/** Unique per registration. Names the `DomPortalTarget` the section's content moves into. */
	id: string
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
	 * entity is drawn, beside colour and opacity, and `test` for controls that
	 * exercise the resource behind the entity.
	 */
	tab?: DetailsTabId
	/**
	 * The section edits the appearance of the entities it applies to, so the panel leaves out its
	 * own color and opacity controls for them. Only meaningful on the `appearance` tab.
	 */
	replacesAppearance?: boolean
}

/** The default tab, applied to a section that names none. */
const DEFAULT_TAB: DetailsTabId = 'details'

/** The sections belonging to `tab`, in registration order. */
export const sectionsForTab = (
	sections: readonly RegisteredDetailsSection[],
	tab: DetailsTabId
): RegisteredDetailsSection[] => sections.filter((section) => (section.tab ?? DEFAULT_TAB) === tab)

/** The `DomPortal` id a section's content moves to, inside the panel showing it. */
export const detailsSectionPortalId = (sectionId: string): string => `details-section:${sectionId}`

interface Context {
	/** Registered sections, in registration order — which is render order. */
	readonly current: RegisteredDetailsSection[]
	/** Adds `section` and returns its release function. Identity-based — each registration stands alone. */
	register: (section: RegisteredDetailsSection) => () => void
	/** The selection a panel is showing the section for, or undefined while no panel shows it. */
	entitiesFor: (sectionId: string) => readonly Entity[] | undefined
	/** Records that a panel is showing the section for `entities`, until the returned release runs. */
	show: (sectionId: string, entities: readonly Entity[]) => () => void
}

export const createDetailsSections = (): Context => {
	const sections = new SvelteSet<RegisteredDetailsSection>()
	const shown = new SvelteMap<string, readonly Entity[]>()

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
		entitiesFor: (sectionId) => shown.get(sectionId),
		show(sectionId, entities) {
			shown.set(sectionId, entities)
			return () => {
				if (shown.get(sectionId) === entities) shown.delete(sectionId)
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
