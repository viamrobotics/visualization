import { ResourceName } from '@viamrobotics/sdk'
import twColors from 'tailwindcss/colors'
import { Color, type ColorRepresentation, type RGB } from 'three'

const linearToSrgb = (x: number) => {
	return x <= 0.0031308 ? 12.92 * x : 1.055 * Math.pow(x, 1 / 2.4) - 0.055
}

const toHex = (x: number) => {
	const hex = Math.round(x * 255)
		.toString(16)
		.padStart(2, '0')
	return hex
}

const oklchToHex = (raw: string) => {
	const match = raw.match(/oklch\(\s*([\d.]+)%\s+([\d.]+)\s+([\d.]+)\s*\)/)

	if (!match) {
		return raw
	}

	const l = Number.parseFloat(match[1]) / 100
	const c = Number.parseFloat(match[2])
	const h = Number.parseFloat(match[3])

	const hRad = (h * Math.PI) / 180

	const aa = c * Math.cos(hRad)
	const bb = c * Math.sin(hRad)

	const l_ = l + 0.3963377774 * aa + 0.2158037573 * bb
	const m_ = l - 0.1055613458 * aa - 0.0638541728 * bb
	const s_ = l - 0.0894841775 * aa - 1.291485548 * bb

	const l_cubed = l_ ** 3
	const m_cubed = m_ ** 3
	const s_cubed = s_ ** 3

	const r_linear = +4.0767416621 * l_cubed - 3.3077115913 * m_cubed + 0.2309699292 * s_cubed
	const g_linear = -1.2684380046 * l_cubed + 2.6097574011 * m_cubed - 0.3413193965 * s_cubed
	const b_linear = -0.0041960863 * l_cubed - 0.7034186147 * m_cubed + 1.707614701 * s_cubed

	const r = Math.max(0, Math.min(1, linearToSrgb(r_linear)))
	const g = Math.max(0, Math.min(1, linearToSrgb(g_linear)))
	const b = Math.max(0, Math.min(1, linearToSrgb(b_linear)))

	return `#${toHex(r)}${toHex(g)}${toHex(b)}`
}

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

const darker = '600'
const lighter = '400'

export const colors = {
	default: oklchToHex(twColors.gray[darker]),
} as const

export const resourceColors = {
	// components
	arm: oklchToHex(twColors.amber[darker]),
	camera: oklchToHex(twColors.blue[darker]),
	base: oklchToHex(twColors.slate[darker]),
	board: oklchToHex(twColors.emerald[darker]),
	button: oklchToHex(twColors.gray[darker]),
	encoder: oklchToHex(twColors.lime[darker]),
	gantry: oklchToHex(twColors.purple[darker]),
	gripper: oklchToHex(twColors.cyan[darker]),
	motor: oklchToHex(twColors.orange[darker]),
	movement_sensor: oklchToHex(twColors.indigo[darker]),
	pose_tracker: oklchToHex(twColors.rose[darker]),
	power_sensor: oklchToHex(twColors.violet[darker]),
	sensor: oklchToHex(twColors.teal[darker]),
	servo: oklchToHex(twColors.yellow[darker]),
	switch: oklchToHex(twColors.stone[darker]),
	webcam: oklchToHex(twColors.sky[darker]),
	audio_in: oklchToHex(twColors.sky[lighter]),
	audio_out: oklchToHex(twColors.violet[lighter]),
	generic: oklchToHex(twColors.gray[lighter]),
	input_controller: oklchToHex(twColors.fuchsia[lighter]),
	// services
	motion: oklchToHex(twColors.green[darker]),
	navigation: oklchToHex(twColors.red[darker]),
	slam: oklchToHex(twColors.pink[darker]),
	vision: oklchToHex(twColors.fuchsia[darker]),
	mlmodel: oklchToHex(twColors.neutral[darker]),
	discovery: oklchToHex(twColors.zinc[darker]),
	data_manager: oklchToHex(twColors.emerald[lighter]),
	video: oklchToHex(twColors.rose[lighter]),
	world_state_store: oklchToHex(twColors.amber[lighter]),
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
