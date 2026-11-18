import { Color } from 'three'

import type { SavedAppearance } from '$lib/resourceAppearance'

import { internalFrameName } from '$lib/kinematicsFrames'

/**
 * The color each frame is drawn in, from what each resource looks like: keyed by the component's
 * own name, and by `<name>:<id>` for a frame inside it that sets its own color.
 */
export const appearanceColorsByFrame = (
	appearanceByComponent: ReadonlyMap<string, SavedAppearance>
): Map<string, Color> => {
	const colors = new Map<string, Color>()
	for (const [componentName, { own, frames }] of appearanceByComponent) {
		if (own.color) colors.set(componentName, new Color(own.color))
		for (const [frameId, appearance] of frames) {
			if (appearance.color) {
				colors.set(internalFrameName(componentName, frameId), new Color(appearance.color))
			}
		}
	}
	return colors
}
