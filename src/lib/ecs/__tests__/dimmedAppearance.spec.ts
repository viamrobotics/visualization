import { Color } from 'three'
import { describe, expect, it } from 'vitest'

import { colors } from '#lib/color.js'

import tailwindConfigCss from '../../../../node_modules/@viamrobotics/tailwind-config/tailwind-config.css?raw'
import { dimColor, DIMMED_BLEND_TARGET, DIMMED_OPACITY, dimOpacity } from '../dimmedAppearance'

const toLinearChannel = (channel: number) =>
	channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4

const relativeLuminance = ([red, green, blue]: number[]) =>
	0.2126 * toLinearChannel(red) + 0.7152 * toLinearChannel(green) + 0.0722 * toLinearChannel(blue)

describe('DIMMED_BLEND_TARGET', () => {
	it('equals --color-gray-5 in the tailwind config', () => {
		const match = /--color-gray-5:\s*(#[0-9a-fA-F]{6})/.exec(tailwindConfigCss)

		expect(match?.[1].toLowerCase()).toBe(DIMMED_BLEND_TARGET)
	})
})

describe('dimColor', () => {
	it('lands halfway to the blend target', () => {
		const dimmed = dimColor(new Color('#000000'))

		expect(dimmed.getHexString()).toBe('909195')
	})

	it('leaves the target itself where it is', () => {
		expect(dimColor(new Color(DIMMED_BLEND_TARGET)).getHexString()).toBe('c5c6cc')
	})
})

describe('dimOpacity', () => {
	it.each([
		{ opacity: 1, expected: 0.5 },
		{ opacity: 0.5, expected: 0.25 },
		{ opacity: 0.25, expected: 0.125 },
		{ opacity: 0, expected: 0 },
	])('resolves $opacity to $expected', ({ opacity, expected }) => {
		expect(dimOpacity(opacity)).toBe(expected)
	})
})

describe('the dimmed default geometry color over white', () => {
	const composited = () => {
		const dimmed = dimColor(new Color(colors.default)).convertLinearToSRGB()
		return dimmed.toArray().map((channel) => channel * DIMMED_OPACITY + (1 - DIMMED_OPACITY))
	}

	it('has a contrast ratio against white of 1.59, below 3:1', () => {
		const ratio = 1.05 / (relativeLuminance(composited()) + 0.05)

		expect(ratio).toBeGreaterThan(1)
		expect(ratio).toBeCloseTo(1.59, 2)
	})
})
