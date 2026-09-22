import { describe, expect, it } from 'vitest'

import { createObstacleComponent, nextObstacleName } from '$lib/obstacle'

describe('nextObstacleName', () => {
	it('starts at obstacle-1 when the config has no obstacles', () => {
		expect(nextObstacleName([])).toBe('obstacle-1')
	})

	it('skips past the obstacles already in the config', () => {
		expect(nextObstacleName(['obstacle-1', 'obstacle-2'])).toBe('obstacle-3')
	})

	it('fills the gap a deleted obstacle left behind', () => {
		expect(nextObstacleName(['obstacle-1', 'obstacle-3'])).toBe('obstacle-2')
	})

	it('ignores names belonging to something other than an obstacle', () => {
		expect(nextObstacleName(['arm-1', 'gripper'])).toBe('obstacle-1')
	})
})

describe('createObstacleComponent', () => {
	it('is a fake generic at the world origin, carrying a 100mm box', () => {
		expect(createObstacleComponent('obstacle-1')).toEqual({
			name: 'obstacle-1',
			api: 'rdk:component:generic',
			model: 'rdk:builtin:fake',
			frame: {
				parent: 'world',
				translation: { x: 0, y: 0, z: 0 },
				orientation: { type: 'ov_degrees', value: { x: 0, y: 0, z: 1, th: 0 } },
				geometry: { type: 'box', x: 100, y: 100, z: 100 },
			},
		})
	})
})
