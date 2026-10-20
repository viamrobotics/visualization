import { describe, expect, it } from 'vitest'

import { createFrame, createTransformFromFrame } from '$lib/frame'

describe('createFrame', () => {
	it('gives the frame no geometry', () => {
		expect(createFrame().geometry).toBeUndefined()
	})

	it('sits at its parent origin with no rotation', () => {
		const frame = createFrame()

		expect(frame.parent).toBe('world')
		expect(frame.translation).toEqual({ x: 0, y: 0, z: 0 })
		expect(frame.orientation).toEqual({
			type: 'ov_degrees',
			value: { x: 0, y: 0, z: 1, th: 0 },
		})
	})

	it('makes a transform with no physical object', () => {
		expect(createTransformFromFrame('gripper', createFrame()).physicalObject).toBeUndefined()
	})
})
