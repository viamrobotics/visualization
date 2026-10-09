import { describe, expect, it } from 'vitest'

import { generateBoundsGeometries } from '$lib/boundsGeometries'
import {
	createBoundsObstacleComponent,
	createComplexObstacleComponent,
	createObstacleComponent,
	DEFAULT_BOUNDS_HINT,
	nextObstacleName,
} from '$lib/obstacle'

describe('nextObstacleName', () => {
	it('starts at obstacle-1 when the config has no obstacles', () => {
		expect(nextObstacleName([], 'obstacle')).toBe('obstacle-1')
	})

	it('skips past the obstacles already in the config', () => {
		expect(nextObstacleName(['obstacle-1', 'obstacle-2'], 'obstacle')).toBe('obstacle-3')
	})

	it('fills the gap a deleted obstacle left behind', () => {
		expect(nextObstacleName(['obstacle-1', 'obstacle-3'], 'obstacle')).toBe('obstacle-2')
	})

	it('ignores names belonging to something other than an obstacle', () => {
		expect(nextObstacleName(['arm-1', 'gripper'], 'obstacle')).toBe('obstacle-1')
	})

	it('counts within the prefix it is given', () => {
		expect(nextObstacleName(['obstacle-1', 'bounds-1'], 'bounds')).toBe('bounds-2')
	})
})

describe('createObstacleComponent', () => {
	it('is an rdk obstacle at the world origin whose shape is a 100mm box', () => {
		expect(createObstacleComponent('obstacle-1')).toEqual({
			name: 'obstacle-1',
			api: 'rdk:component:generic',
			model: 'rdk:builtin:obstacle',
			frame: {
				parent: 'world',
				translation: { x: 0, y: 0, z: 0 },
				orientation: { type: 'ov_degrees', value: { x: 0, y: 0, z: 1, th: 0 } },
			},
			attributes: {
				geometries: [{ label: 'shape', type: 'box', x: 100, y: 100, z: 100 }],
			},
			visualizer: { type: 'simple' },
		})
	})

	it('leaves geometry off the component frame, since rdk would use it over the geometries', () => {
		expect(createObstacleComponent('obstacle-1').frame).not.toHaveProperty('geometry')
	})
})

describe('createComplexObstacleComponent', () => {
	it('is an rdk obstacle at the world origin with one 100mm box and a complex hint', () => {
		expect(createComplexObstacleComponent('obstacle-1')).toEqual({
			name: 'obstacle-1',
			api: 'rdk:component:generic',
			model: 'rdk:builtin:obstacle',
			frame: {
				parent: 'world',
				translation: { x: 0, y: 0, z: 0 },
				orientation: { type: 'ov_degrees', value: { x: 0, y: 0, z: 1, th: 0 } },
			},
			attributes: {
				geometries: [{ label: 'shape-1', type: 'box', x: 100, y: 100, z: 100 }],
			},
			visualizer: { type: 'complex' },
		})
	})

	it('leaves geometry off the component frame, since rdk would use it over the geometries', () => {
		expect(createComplexObstacleComponent('obstacle-1').frame).not.toHaveProperty('geometry')
	})
})

describe('createBoundsObstacleComponent', () => {
	it('is an rdk obstacle parented to the world', () => {
		const component = createBoundsObstacleComponent('walls')

		expect(component).toMatchObject({
			name: 'walls',
			api: 'rdk:component:generic',
			model: 'rdk:builtin:obstacle',
			frame: { parent: 'world' },
		})
	})

	it('rests the top of its 10mm floor, 505mm below its frame, on the ground plane', () => {
		const { frame, attributes } = createBoundsObstacleComponent('walls')

		expect(attributes?.geometries).toContainEqual(
			expect.objectContaining({ label: 'floor', z: 10, translation: { x: 0, y: 0, z: -505 } })
		)
		expect(frame?.translation).toEqual({ x: 0, y: 0, z: 500 })
	})

	it('leaves geometry off the component frame, since rdk would use it over the geometries', () => {
		expect(createBoundsObstacleComponent('walls').frame).not.toHaveProperty('geometry')
	})

	it('carries the walls generated from the default hint', () => {
		expect(createBoundsObstacleComponent('walls').attributes?.geometries).toEqual(
			generateBoundsGeometries(DEFAULT_BOUNDS_HINT)
		)
	})

	it('records a 1000mm interior with 10mm walls as the hint', () => {
		expect(createBoundsObstacleComponent('walls').visualizer).toEqual({
			type: 'bounds',
			x_mm: 1000,
			y_mm: 1000,
			z_mm: 1000,
			wall_thickness_mm: 10,
			exclude: [],
		})
	})

	it('copies the hint so editing one component cannot change the default', () => {
		const hint = createBoundsObstacleComponent('walls').visualizer as {
			exclude: string[]
		}

		hint.exclude.push('floor')

		expect(DEFAULT_BOUNDS_HINT.exclude).toEqual([])
	})
})

describe.each([
	['simple', createObstacleComponent],
	['bounds', createBoundsObstacleComponent],
	['complex', createComplexObstacleComponent],
])('the %s obstacle attributes', (_kind, create) => {
	it('has no frames key', () => {
		expect(create('obstacle-1').attributes).not.toHaveProperty('frames')
	})
})

describe.each([
	['simple', createObstacleComponent],
	['complex', createComplexObstacleComponent],
])('the %s obstacle geometries', (_kind, create) => {
	it('is never empty, since rdk rejects an empty list', () => {
		expect((create('obstacle-1').attributes?.geometries as unknown[]).length).toBeGreaterThan(0)
	})
})
