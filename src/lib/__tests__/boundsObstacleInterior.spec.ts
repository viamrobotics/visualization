import { describe, expect, it } from 'vitest'

import type { PartComponent } from '$lib/hooks/usePartConfig.svelte'

import { generateBoundsGeometries } from '$lib/boundsGeometries'
import {
	boundsHintInterior,
	boundsObstacleNamed,
	resizeBoundsObstacle,
} from '$lib/boundsObstacleInterior'
import { createBoundsObstacleComponent, createObstacleComponent } from '$lib/obstacle'
import { type BoundsHint } from '$lib/obstacleAttributes'
import { obstacleEditorType } from '$lib/obstacleEditorType'

const OPEN_TOP_HINT: BoundsHint = {
	type: 'bounds',
	x_mm: 400,
	y_mm: 300,
	z_mm: 200,
	wall_thickness_mm: 20,
	exclude: ['ceiling'],
}

const openTopBounds = (): PartComponent => ({
	...createBoundsObstacleComponent('bounds-1'),
	attributes: { extra: 'kept', geometries: generateBoundsGeometries(OPEN_TOP_HINT) },
	visualizer: { ...OPEN_TOP_HINT, color: '#ff0000' },
})

describe('boundsObstacleNamed', () => {
	it('finds a Bounds obstacle by name, with its hint', () => {
		const bounds = openTopBounds()

		expect(boundsObstacleNamed([bounds], 'bounds-1')).toEqual({
			component: bounds,
			hint: OPEN_TOP_HINT,
		})
	})

	it('reads the hint from the walls of a Bounds obstacle stored without one', () => {
		const bounds: PartComponent = { ...openTopBounds(), visualizer: undefined }

		expect(boundsObstacleNamed([bounds], 'bounds-1')?.hint).toEqual(OPEN_TOP_HINT)
	})

	it('finds nothing for a Simple obstacle', () => {
		expect(
			boundsObstacleNamed([createObstacleComponent('obstacle-1')], 'obstacle-1')
		).toBeUndefined()
	})
})

describe('boundsHintInterior', () => {
	it('reads the interior from the hint', () => {
		expect(boundsHintInterior(OPEN_TOP_HINT)).toEqual({ x: 400, y: 300, z: 200 })
	})
})

describe('resizeBoundsObstacle', () => {
	it('resizes the interior and keeps the wall thickness, the left-out walls and the rest of the visualizer config', () => {
		const { visualizer } = resizeBoundsObstacle(openTopBounds(), OPEN_TOP_HINT, {
			x: 800,
			y: 300,
			z: 200,
		})

		expect(visualizer).toEqual({
			type: 'bounds',
			x_mm: 800,
			y_mm: 300,
			z_mm: 200,
			wall_thickness_mm: 20,
			exclude: ['ceiling'],
			color: '#ff0000',
		})
	})

	it('moves the walls out to the new interior and keeps the other attributes', () => {
		const { attributes } = resizeBoundsObstacle(openTopBounds(), OPEN_TOP_HINT, {
			x: 800,
			y: 300,
			z: 200,
		})

		expect(attributes?.extra).toBe('kept')
		expect(attributes?.geometries).toContainEqual({
			label: 'x_max',
			type: 'box',
			x: 20,
			y: 340,
			z: 240,
			translation: { x: 410, y: 0, z: 0 },
		})
	})

	it('stays a Bounds obstacle after a resize', () => {
		const component = openTopBounds()

		const resized = {
			...component,
			...resizeBoundsObstacle(component, OPEN_TOP_HINT, { x: 1, y: 2, z: 3 }),
		}

		expect(obstacleEditorType(resized)).toBe('bounds')
	})

	it('keeps the interior positive when shrunk to nothing', () => {
		const { visualizer } = resizeBoundsObstacle(openTopBounds(), OPEN_TOP_HINT, {
			x: 0,
			y: -5,
			z: 200,
		})

		expect(visualizer).toMatchObject({ x_mm: 1, y_mm: 1, z_mm: 200 })
	})
})
