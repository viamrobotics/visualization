import { describe, expect, it } from 'vitest'

import { clampPanelPosition } from '$lib/components/overlay/clampPanelPosition'

const PANEL = { width: 240, height: 400 }
const SCENE = { width: 1000, height: 600 }

describe('clampPanelPosition', () => {
	it('leaves a panel that already fits where it is', () => {
		expect(clampPanelPosition({ x: 10, y: 48 }, PANEL, SCENE)).toEqual({ x: 10, y: 48 })
	})

	it.each([
		{ edge: 'bottom', position: { x: 10, y: 350 }, expected: { x: 10, y: 200 } },
		{ edge: 'right', position: { x: 900, y: 48 }, expected: { x: 760, y: 48 } },
		{ edge: 'top', position: { x: 10, y: -23 }, expected: { x: 10, y: 0 } },
		{ edge: 'left', position: { x: -50, y: 48 }, expected: { x: 0, y: 48 } },
	])('pulls a panel hanging past the $edge edge back inside', ({ position, expected }) => {
		expect(clampPanelPosition(position, PANEL, SCENE)).toEqual(expected)
	})

	it('pins a panel taller than the scene to the top, keeping its header in reach', () => {
		const shortScene = { width: 1000, height: 300 }

		expect(clampPanelPosition({ x: 10, y: 48 }, PANEL, shortScene)).toEqual({ x: 10, y: 0 })
	})

	it('pins a panel wider than the scene to the left', () => {
		const narrowScene = { width: 200, height: 600 }

		expect(clampPanelPosition({ x: 10, y: 48 }, PANEL, narrowScene)).toEqual({ x: 0, y: 48 })
	})
})
