import { Color } from 'three'
import { describe, expect, it } from 'vitest'

import { appearanceColorsByFrame } from '$lib/appearanceColors'
import { savedAppearanceOf } from '$lib/resourceAppearance'

describe('appearanceColorsByFrame', () => {
	it('maps each color to the frame it colors', () => {
		const cage = savedAppearanceOf({
			name: 'cage',
			visualizer: {
				color: '#ff0000',
				frames: { post: { color: '#00ff00' }, wall: { opacity: 1 } },
			},
		})
		const camera = savedAppearanceOf({ name: 'camera' })

		const colors = appearanceColorsByFrame(
			new Map([
				['cage', cage],
				['camera', camera],
			])
		)

		expect([...colors.keys()]).toEqual(['cage', 'cage:post'])
		expect(colors.get('cage')?.equals(new Color('#ff0000'))).toBe(true)
		expect(colors.get('cage:post')?.equals(new Color('#00ff00'))).toBe(true)
	})
})
