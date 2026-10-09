import { Color } from 'three'

import type { PartComponent } from '$lib/hooks/usePartConfig.svelte'

import { internalFrameName } from '$lib/kinematicsFrames'
import { savedAppearanceOf } from '$lib/resourceAppearance'

/**
 * The color saved in each part component's `visualizer` config, by the frame it colors: the
 * component's own name, and `<name>:<id>` for a frame inside it that saves its own color.
 */
export const configColorsByFrame = (
	components: PartComponent[] | undefined
): Map<string, Color> => {
	const colors = new Map<string, Color>()
	for (const component of components ?? []) {
		const { own, frames } = savedAppearanceOf(component)
		if (own.color) colors.set(component.name, new Color(own.color))
		for (const [frameId, appearance] of frames) {
			if (appearance.color) {
				colors.set(internalFrameName(component.name, frameId), new Color(appearance.color))
			}
		}
	}
	return colors
}
