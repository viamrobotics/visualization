import type { PartComponent } from '#lib/hooks/usePartConfig.svelte.js'

/** One frame's appearance change: the component it is saved under, and the change. */
export interface AppearanceEdit {
	/** The component as it stands before any of the changes. */
	component: PartComponent
	/** Returns the component's next `visualizer` field with this change made. */
	edit: (component: PartComponent) => Record<string, unknown>
}

/**
 * Applies every change, folding changes to the same component into one write. Several
 * selected frames can live inside one component, and writing each against the component
 * as it stood would keep only the last frame's change.
 *
 * @returns Each touched component's name, mapped to its next `visualizer` field.
 */
export const foldAppearanceEdits = (
	edits: readonly AppearanceEdit[]
): Map<string, Record<string, unknown>> => {
	const folded = new Map<string, Record<string, unknown>>()

	for (const { component, edit } of edits) {
		const saved = folded.get(component.name)
		folded.set(component.name, edit(saved ? { ...component, visualizer: saved } : component))
	}

	return folded
}
