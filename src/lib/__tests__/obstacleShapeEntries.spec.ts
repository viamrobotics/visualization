import { describe, expect, it } from 'vitest'

import type { PartComponent } from '$lib/hooks/usePartConfig.svelte'

import {
	createBoundsObstacleComponent,
	createComplexObstacleComponent,
	createObstacleComponent,
} from '$lib/obstacle'
import { obstacleShapeEntries } from '$lib/obstacleShapeEntries'

const complexWithTwoShapes = (): PartComponent => ({
	...createComplexObstacleComponent('cage'),
	attributes: {
		geometries: [
			{ label: 'post', type: 'box', x: 10, y: 10, z: 10 },
			{ type: 'sphere', r: 5 },
		],
	},
})

describe('obstacleShapeEntries', () => {
	it('places each Complex shape by its frame name, unlabeled ones by position', () => {
		const entries = obstacleShapeEntries([complexWithTwoShapes()])

		expect(entries.get('cage:post')).toEqual({ owner: 'cage', index: 0, isComplex: true })
		expect(entries.get('cage:geometry_1')).toEqual({ owner: 'cage', index: 1, isComplex: true })
	})

	it('marks a Simple obstacle shape as moving with its obstacle', () => {
		const entries = obstacleShapeEntries([createObstacleComponent('obstacle-1')])

		expect(entries.get('obstacle-1:shape')).toEqual({
			owner: 'obstacle-1',
			index: 0,
			isComplex: false,
		})
	})

	it('marks a Bounds wall as moving with its obstacle', () => {
		const entries = obstacleShapeEntries([createBoundsObstacleComponent('bounds-1')])

		expect(entries.get('bounds-1:ceiling')?.isComplex).toBe(false)
	})

	it('skips components that are not obstacles', () => {
		const arm: PartComponent = { name: 'arm', api: 'rdk:component:arm', model: 'rdk:builtin:fake' }

		expect(obstacleShapeEntries([arm]).size).toBe(0)
	})
})
