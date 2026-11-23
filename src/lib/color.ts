import { ResourceName } from '@viamrobotics/sdk'
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

export const resourceNameToColor = (resourceName?: ResourceName) => {
	if (!resourceName) return undefined
	return subtypeToColor(resourceName.subtype)
}

export const subtypeToColor = (subtype?: string) => {
	if (!subtype) return undefined
	const colorValue = resourceColors[subtype as keyof typeof resourceColors]
	if (!colorValue) return undefined
	return new Color(colorValue)
}

export const colors = {
	default: '#4a5565',
} as const

/**
 * The color each resource subtype draws in. The values are Tailwind's default palette at shade
 * 600, and at shade 400 for the lighter entries, written out so no host needs Tailwind at runtime.
 * They belong in `@viamrobotics/tailwind-config` once it ships a resource palette.
 */
export const resourceColors = {
	// components
	arm: '#e17100',
	camera: '#155dfc',
	base: '#45556c',
	board: '#009966',
	button: '#4a5565',
	encoder: '#5ea500',
	gantry: '#9810fa',
	gripper: '#0092b8',
	motor: '#f54900',
	movement_sensor: '#4f39f6',
	pose_tracker: '#ec003f',
	power_sensor: '#7f22fe',
	sensor: '#009689',
	servo: '#d08700',
	switch: '#57534d',
	webcam: '#0084d1',
	audio_in: '#00bcff',
	audio_out: '#a684ff',
	generic: '#99a1af',
	input_controller: '#ed6aff',
	// services
	motion: '#00a63e',
	navigation: '#e7000b',
	slam: '#e60076',
	vision: '#c800de',
	mlmodel: '#525252',
	discovery: '#52525c',
	data_manager: '#00d492',
	video: '#ff637e',
	world_state_store: '#ffb900',
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
