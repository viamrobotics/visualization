import type { Frame } from '$lib/frame'

export const resource = {
	name: 'Test Object',
	frame: {
		parent: 'parent_frame',
		translation: { x: 10, y: 20, z: 30 },
		orientation: { type: 'ov_degrees', value: { x: 0, y: 0, z: 1, th: 0 } },
		geometry: {
			type: 'box',
			x: 10,
			y: 20,
			z: 30,
		},
	} satisfies Frame,
}
