import { Color, type ColorRepresentation, type RGB } from 'three'
import twColors from 'tailwindcss/colors'
import { isNumber } from 'lodash-es'

// Step 3: linear sRGB → sRGB
const linearToSrgb = (x: number) => {
	return x <= 0.0031308 ? 12.92 * x : 1.055 * Math.pow(x, 1 / 2.4) - 0.055
}

// Step 4: sRGB → hex
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

	const l = parseFloat(match[1]) / 100
	const c = parseFloat(match[2])
	const h = parseFloat(match[3])

	// Convert h from degrees to radians
	const hRad = (h * Math.PI) / 180

	// Step 1: OKLCH → OKLab
	const aa = c * Math.cos(hRad)
	const bb = c * Math.sin(hRad)

	// Step 2: OKLab → linear sRGB
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

/**
 * Darkens a THREE.Color by a given percentage while preserving hue.
 * @param color The original THREE.Color instance.
 * @param percent The percentage to darken (0-100).
 * @returns A new THREE.Color instance with the darkened color.
 */
export const darkenColor = (value: ColorRepresentation, percent: number): Color => {
	const original = new Color(value)
	const hsl = original.getHSL({ h: 0, s: 0, l: 0 })
	hsl.l = Math.max(0, hsl.l * (1 - percent / 100))
	return new Color().setHSL(hsl.h, hsl.s, hsl.l)
}

const darkness = '600'

export const colors = {
	default: oklchToHex(twColors.red[darkness]),
} as const

export const resourceColors = {
	arm: oklchToHex(twColors.amber[darkness]),
	camera: oklchToHex(twColors.blue[darkness]),
	base: oklchToHex(twColors.slate[darkness]),
	board: oklchToHex(twColors.emerald[darkness]),
	button: oklchToHex(twColors.gray[darkness]),
	encoder: oklchToHex(twColors.lime[darkness]),
	gantry: oklchToHex(twColors.purple[darkness]),
	gripper: oklchToHex(twColors.cyan[darkness]),
	motor: oklchToHex(twColors.orange[darkness]),
	movement_sensor: oklchToHex(twColors.indigo[darkness]),
	pose_tracker: oklchToHex(twColors.rose[darkness]),
	power_sensor: oklchToHex(twColors.violet[darkness]),
	sensor: oklchToHex(twColors.teal[darkness]),
	servo: oklchToHex(twColors.yellow[darkness]),
	switch: oklchToHex(twColors.stone[darkness]),
	webcam: oklchToHex(twColors.sky[darkness]),
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

	return isNumber(color.r) && isNumber(color.g) && isNumber(color.b)
}

export const parseRGB = (color: unknown, defaultColor: RGB = { r: 0, g: 0, b: 0 }): Color => {
	if (!isRGB(color)) return new Color().setRGB(defaultColor.r, defaultColor.g, defaultColor.b)
	return new Color().setRGB(color.r, color.g, color.b)
}

export const parseOpacity = (opacity: unknown, defaultOpacity: number = 1): number => {
	if (!isNumber(opacity)) return defaultOpacity
	return opacity > 1 ? opacity / 100 : opacity
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
