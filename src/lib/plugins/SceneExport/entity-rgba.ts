import type { Entity } from 'koota'

import { Color, SRGBColorSpace } from 'three'

import { asColor } from '$lib/buffer'
import { colors } from '$lib/color'
import { resolveOpacity, traits } from '$lib/ecs'

const linearColor = new Color()
const srgb = { r: 0, g: 0, b: 0 }

/**
 * The color a sim should draw `color` in. The scene stores colors in three's linear working space,
 * and sims read `rgba` as display values, so it converts back to sRGB.
 */
export const toSimRgba = (color: Color, alpha: number): [number, number, number, number] => {
	color.getRGB(srgb, SRGBColorSpace)
	return [srgb.r, srgb.g, srgb.b, alpha]
}

/**
 * The color the scene draws `entity`'s geometry in, resolved in the same order as the shape
 * renderers: first vertex color, then `Color`, then the theme default.
 */
export const entityRgba = (entity: Entity): [number, number, number, number] => {
	const vertexColors = entity.get(traits.Colors)
	const color = entity.get(traits.Color)

	if (vertexColors && vertexColors.length >= 3) {
		asColor(vertexColors, linearColor)
	} else if (color) {
		linearColor.setRGB(color.r, color.g, color.b)
	} else {
		linearColor.set(colors.default)
	}

	return toSimRgba(linearColor, resolveOpacity(entity))
}
