import type { EnvironmentMode } from '$lib/hooks/useEnvironment.svelte'
import type { PartComponent } from '$lib/hooks/usePartConfig.svelte'

import {
	layeredAppearance,
	NO_SAVED_APPEARANCE,
	type SavedAppearance,
	savedAppearanceOf,
} from '$lib/resourceAppearance'

/**
 * How each resource is drawn in `mode`, by component name. Build mode edits the saved
 * `visualizer` config, so it draws that alone. Every other mode lays the session's unsaved edits
 * over it. A session edit may name a resource the part config does not own, such as a frame the
 * machine reports from a fragment.
 */
export const resolvedAppearanceByComponent = (
	components: PartComponent[] | undefined,
	session: ReadonlyMap<string, Record<string, unknown>>,
	mode: EnvironmentMode | 'none'
): Map<string, SavedAppearance> => {
	const resolved = new Map(
		(components ?? []).map((component) => [component.name, savedAppearanceOf(component)])
	)
	if (mode === 'build') return resolved

	for (const [name, visualizer] of session) {
		resolved.set(
			name,
			layeredAppearance(
				resolved.get(name) ?? NO_SAVED_APPEARANCE,
				savedAppearanceOf({ name, visualizer })
			)
		)
	}

	return resolved
}
