import { Color, type ColorRepresentation, type RGB } from 'three'

const original = new Color()
const hsl = { h: 0, s: 0, l: 0 }
/**
 * Darkens a color by a percentage of its HSL lightness, preserving hue and saturation.
 *
 * @param percent 0 to 100.
 */
export const darkenColor = (value: ColorRepresentation, percent: number): Color => {
	original.set(value)
	original.getHSL(hsl)
	hsl.l = Math.max(0, hsl.l * (1 - percent / 100))
	return new Color().setHSL(hsl.h, hsl.s, hsl.l)
}

export const colors = {
	default: '#4a5565',
} as const

export const isColorRepresentation = (color: unknown): color is ColorRepresentation => {
	if (!color) return false
	if (isColorString(color)) return true
	if (isColorHex(color)) return true
	if (isColor(color)) return true
	return false
}

export const parseColor = (color: unknown, defaultColor: ColorRepresentation = 'black'): Color => {
	if (!isColorRepresentation(color)) return new Color(defaultColor)
	return new Color(color)
}

export const isRGB = (color: unknown): color is RGB => {
	if (
		!color ||
		typeof color !== 'object' ||
		!('r' in color) ||
		!('g' in color) ||
		!('b' in color)
	) {
		return false
	}

	return typeof color.r === 'number' && typeof color.g === 'number' && typeof color.b === 'number'
}

export const parseRGB = (color: unknown, defaultColor: RGB = { r: 0, g: 0, b: 0 }): Color => {
	if (!isRGB(color))
		return new Color().setRGB(
			defaultColor.r > 1 ? defaultColor.r / 255 : defaultColor.r,
			defaultColor.g > 1 ? defaultColor.g / 255 : defaultColor.g,
			defaultColor.b > 1 ? defaultColor.b / 255 : defaultColor.b
		)

	return new Color().setRGB(
		color.r > 1 ? color.r / 255 : color.r,
		color.g > 1 ? color.g / 255 : color.g,
		color.b > 1 ? color.b / 255 : color.b
	)
}

const isColor = (color: unknown): color is Color => {
	if (!color) return false
	return color instanceof Color
}

const isColorString = (color: unknown): color is string => {
	if (!color) return false
	if (typeof color === 'string') {
		const parsed = new Color(color)
		return parsed.isColor
	}

	return false
}

const isColorHex = (color: unknown): color is string => {
	if (!color) return false
	if (typeof color === 'number') {
		const parsed = new Color(color)
		return parsed.isColor
	}

	return false
}

export const rgbToHex = (rgb: Uint8Array): string => {
	if (rgb.length < 3) return '#333333'
	const r = rgb[0]!.toString(16).padStart(2, '0')
	const g = rgb[1]!.toString(16).padStart(2, '0')
	const b = rgb[2]!.toString(16).padStart(2, '0')
	return `#${r}${g}${b}`
}
