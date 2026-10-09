import { Color } from 'three'
import { describe, expect, it } from 'vitest'

import { configColorsByFrame } from '$lib/configColors'

describe('configColorsByFrame', () => {
	it('maps each saved color to the frame it colors', () => {
		const colors = configColorsByFrame([
			{
				name: 'cage',
				visualizer: {
					color: '#ff0000',
					frames: { post: { color: '#00ff00' }, wall: { opacity: 1 } },
				},
			},
			{ name: 'camera' },
		])

		expect([...colors.keys()]).toEqual(['cage', 'cage:post'])
		expect(colors.get('cage')?.equals(new Color('#ff0000'))).toBe(true)
		expect(colors.get('cage:post')?.equals(new Color('#00ff00'))).toBe(true)
	})
})
