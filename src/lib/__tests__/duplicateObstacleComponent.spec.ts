import { describe, expect, it } from 'vitest'

import { duplicateObstacleComponent } from '$lib/duplicateObstacleComponent'
import { createBoundsObstacleComponent, createObstacleComponent } from '$lib/obstacle'

describe('duplicateObstacleComponent', () => {
	it('names the copy after its source with the first free number', () => {
		const source = createObstacleComponent('obstacle-1')

		expect(duplicateObstacleComponent(source, ['obstacle-1']).name).toBe('obstacle-1-1')
		expect(duplicateObstacleComponent(source, ['obstacle-1', 'obstacle-1-1']).name).toBe(
			'obstacle-1-2'
		)
	})

	it('copies the frame, attributes and visualizer without sharing them', () => {
		const source = createBoundsObstacleComponent('bounds-1')
		source.visualizer = { ...source.visualizer, color: '#ff0000' }

		const copy = duplicateObstacleComponent(source, ['bounds-1'])

		expect(copy).toEqual({ ...source, name: 'bounds-1-1' })
		expect(copy.frame).not.toBe(source.frame)
		expect(copy.attributes).not.toBe(source.attributes)
		expect(copy.visualizer).not.toBe(source.visualizer)
	})

	it('leaves its source unchanged', () => {
		const source = createObstacleComponent('obstacle-1')
		const snapshot = JSON.stringify(source)

		duplicateObstacleComponent(source, ['obstacle-1'])

		expect(JSON.stringify(source)).toBe(snapshot)
	})
})
