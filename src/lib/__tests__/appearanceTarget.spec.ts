import { describe, expect, it } from 'vitest'

import { appearanceKeyOf, appearanceTargetOf } from '$lib/appearanceTarget'
import { createComplexObstacleComponent } from '$lib/obstacle'

describe('appearanceTargetOf', () => {
	const cage = createComplexObstacleComponent('cage')

	it('saves a component frame on the component itself', () => {
		expect(appearanceTargetOf([cage], 'cage')).toEqual({ component: cage, frameId: undefined })
	})

	it('saves a frame inside a component on that component, under its id', () => {
		expect(appearanceTargetOf([cage], 'cage:shape-1')).toEqual({
			component: cage,
			frameId: 'shape-1',
		})
	})

	it('has nowhere to save a frame no part component owns', () => {
		expect(appearanceTargetOf([cage], 'remote:arm')).toBeUndefined()
		expect(appearanceTargetOf([cage], 'drawn-box')).toBeUndefined()
	})
})

describe('appearanceKeyOf', () => {
	it('keeps a frame inside a component under that component and its id', () => {
		expect(appearanceKeyOf('cage:post')).toEqual({ componentName: 'cage', frameId: 'post' })
	})

	it('keeps any other frame under its own name, with or without a part component', () => {
		expect(appearanceKeyOf('drawn-box')).toEqual({ componentName: 'drawn-box', frameId: undefined })
	})
})
