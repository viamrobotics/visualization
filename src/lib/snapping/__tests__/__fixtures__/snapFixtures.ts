import { Matrix4, Quaternion, Ray, Vector2, Vector3 } from 'three'

import type { SnapShape } from '../../snapShape'

import { type SnapQuery } from '../../snapQuery'

/** Canvas pixels per metre in the top-down view the snap specs look through. */
export const PIXELS_PER_METRE = 100

export const box = (x: number, y: number, z: number): SnapShape => ({
	kind: 'box',
	halfSize: new Vector3(x / 2, y / 2, z / 2),
})

export const placed = (x: number, y: number, z: number, orientation = new Quaternion()) =>
	new Matrix4().compose(new Vector3(x, y, z), orientation, new Vector3(1, 1, 1))

/** The camera height the top-down view looks down from. */
const CAMERA_Z = 10

/**
 * A query seen from straight above: rays drop from `CAMERA_Z`, and a world point lands at its x
 * and y scaled to pixels.
 */
export const topDownQuery = (
	cursor: { x: number; y: number },
	overrides: Partial<SnapQuery>
): SnapQuery => ({
	position: new Vector3(),
	orientation: new Quaternion(),
	dragged: [],
	targets: [],
	constraint: { kind: 'free' },
	ray: new Ray(new Vector3(cursor.x, cursor.y, CAMERA_Z), new Vector3(0, 0, -1)),
	cursor: new Vector2(cursor.x, cursor.y).multiplyScalar(PIXELS_PER_METRE),
	toScreen: (point, out) => {
		out.set(point.x, point.y).multiplyScalar(PIXELS_PER_METRE)
		return true
	},
	rayThrough: (point, out) =>
		out.set(new Vector3(point.x, point.y, CAMERA_Z), new Vector3(0, 0, -1)),
	groundPlane: false,
	alignRotation: false,
	...overrides,
})
