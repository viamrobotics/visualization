import { WorldObject } from '$lib/WorldObject.svelte'
import type { Geometry } from '@viamrobotics/sdk'

export const createWorldObjectFixture = () => {
	const object = new WorldObject()
	object.name = 'Test Object'
	object.uuid = '1234-5678'
	object.referenceFrame = 'parent_frame'
	object.pose = {
		x: 10,
		y: 20,
		z: 30,
		oX: 0.1,
		oY: 0.2,
		oZ: 0.3,
		theta: 0.4,
	}

	object.geometry = {
		label: 'my geometry',
		geometryType: {
			case: 'box',
			value: {
				dimsMm: { x: 10, y: 20, z: 30 },
			},
		},
	} satisfies Geometry

	object.localEditedPose = {
		x: 10,
		y: 20,
		z: 30,
		oX: 0.1,
		oY: 0.2,
		oZ: 0.3,
		theta: 0.4,
	}

	return object
}
