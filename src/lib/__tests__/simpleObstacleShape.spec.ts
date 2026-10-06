import { describe, expect, it } from 'vitest'

import type { PartComponent } from '$lib/hooks/usePartConfig.svelte'

import { createBoundsObstacleComponent, createObstacleComponent } from '$lib/obstacle'
import {
	simpleObstacleNamed,
	simpleObstacleShape,
	withSimpleObstacleShape,
} from '$lib/simpleObstacleShape'

const offsetSphereObstacle = (): PartComponent => ({
	...createObstacleComponent('ball'),
	attributes: {
		extra: 'kept',
		geometries: [{ label: 'ball', type: 'sphere', r: 40, translation: { x: 0, y: 0, z: 200 } }],
	},
})

describe('simpleObstacleNamed', () => {
	it('finds a Simple obstacle by name', () => {
		const obstacle = createObstacleComponent('obstacle-1')

		expect(simpleObstacleNamed([obstacle], 'obstacle-1')).toBe(obstacle)
	})

	it('finds nothing for a Bounds obstacle', () => {
		expect(
			simpleObstacleNamed([createBoundsObstacleComponent('bounds-1')], 'bounds-1')
		).toBeUndefined()
	})

	it('finds nothing for a component that is not an obstacle', () => {
		const arm: PartComponent = { name: 'arm', api: 'rdk:component:arm', model: 'rdk:builtin:fake' }

		expect(simpleObstacleNamed([arm], 'arm')).toBeUndefined()
	})
})

describe('simpleObstacleShape', () => {
	it('reads the shape without its label or offset', () => {
		expect(simpleObstacleShape(offsetSphereObstacle())).toEqual({ type: 'sphere', r: 40 })
	})
})

describe('withSimpleObstacleShape', () => {
	it('replaces the shape and keeps the label, offset and other attributes', () => {
		const attributes = withSimpleObstacleShape(offsetSphereObstacle(), { type: 'sphere', r: 80 })

		expect(attributes).toEqual({
			extra: 'kept',
			geometries: [{ label: 'ball', type: 'sphere', r: 80, translation: { x: 0, y: 0, z: 200 } }],
		})
	})
})
