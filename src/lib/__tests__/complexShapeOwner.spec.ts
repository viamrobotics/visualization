import { describe, expect, it } from 'vitest'

import { complexShapeOwner } from '$lib/complexShapeOwner'
import { createComplexObstacleComponent } from '$lib/obstacle'

describe('complexShapeOwner', () => {
	const cage = createComplexObstacleComponent('cage')

	it('finds the obstacle a shape frame is namespaced under', () => {
		expect(complexShapeOwner([cage], 'cage:shape-1')).toBe(cage)
	})

	it('finds nothing for a frame that is not namespaced', () => {
		expect(complexShapeOwner([cage], 'cage')).toBeUndefined()
		expect(complexShapeOwner([cage], undefined)).toBeUndefined()
	})

	it('finds nothing when the owner is not part of the config', () => {
		expect(complexShapeOwner([cage], 'gate:shape-1')).toBeUndefined()
	})
})
