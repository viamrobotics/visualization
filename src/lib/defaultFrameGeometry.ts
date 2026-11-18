import type { Frame } from '$lib/frame'

export type EditableFrameGeometry = NonNullable<Frame['geometry']>

/** The geometry a frame gets when the user switches it to `type`, in mm. */
export const defaultFrameGeometry = (
	type: EditableFrameGeometry['type']
): EditableFrameGeometry => {
	switch (type) {
		case 'box': {
			return { type: 'box', x: 100, y: 100, z: 100 }
		}
		case 'sphere': {
			return { type: 'sphere', r: 100 }
		}
		case 'capsule': {
			return { type: 'capsule', r: 20, l: 100 }
		}
		default: {
			return { type: 'none' }
		}
	}
}
