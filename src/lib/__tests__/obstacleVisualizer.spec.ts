import { describe, expect, it } from 'vitest'

import type { PartComponent } from '$lib/hooks/usePartConfig.svelte'

import { DEFAULT_BOUNDS_HINT } from '$lib/obstacle'
import {
	afterRemovingShape,
	complexObstacleVisualizer,
	SHAPES_IN_PLACE,
	withObstacleHint,
} from '$lib/obstacleVisualizer'

const boundsWithColor = (): PartComponent => ({
	name: 'bounds-1',
	visualizer: { ...DEFAULT_BOUNDS_HINT, color: '#ff0000' },
})

describe('withObstacleHint', () => {
	it('drops every key of the old hint the new one does not set', () => {
		expect(withObstacleHint(boundsWithColor(), { type: 'complex' })).toEqual({
			type: 'complex',
			color: '#ff0000',
		})
	})

	it('writes the hint onto a component with no visualizer config', () => {
		expect(withObstacleHint({ name: 'bare' }, { type: 'simple' })).toEqual({ type: 'simple' })
	})
})

describe('complexObstacleVisualizer', () => {
	const cage = (): PartComponent => ({
		name: 'cage',
		attributes: {
			geometries: [
				{ label: 'post', type: 'box', x: 1, y: 1, z: 1 },
				{ type: 'sphere', r: 1 },
				{ type: 'sphere', r: 2 },
			],
		},
		visualizer: {
			type: 'complex',
			frames: { post: { color: '#ff0000' }, geometry_2: { opacity: 0.4 } },
		},
	})

	it('moves a relabeled shape entry to its new label', () => {
		const next = [
			{ label: 'pillar', type: 'box' as const, x: 1, y: 1, z: 1 },
			{ type: 'sphere' as const, r: 1 },
			{ type: 'sphere' as const, r: 2 },
		]

		expect(complexObstacleVisualizer(cage(), next, SHAPES_IN_PLACE).frames).toEqual({
			pillar: { color: '#ff0000' },
			geometry_2: { opacity: 0.4 },
		})
	})

	it('drops a removed shape entry and renumbers the unlabeled shapes after it', () => {
		const next = [
			{ type: 'sphere' as const, r: 1 },
			{ type: 'sphere' as const, r: 2 },
		]

		expect(complexObstacleVisualizer(cage(), next, afterRemovingShape(0)).frames).toEqual({
			geometry_1: { opacity: 0.4 },
		})
	})

	it('writes the Complex hint', () => {
		const component: PartComponent = { ...cage(), visualizer: { type: 'simple' } }

		expect(complexObstacleVisualizer(component, [], SHAPES_IN_PLACE)).toEqual({ type: 'complex' })
	})
})
