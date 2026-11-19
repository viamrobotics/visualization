import { Matrix4, Vector3 } from 'three'

import type { SimBody, SimGeom, SimJoint, SimShape } from '../sim-scene'

/** A welded body at the origin of its parent, with no geoms unless given. */
export const simBody = (name: string, overrides: Partial<SimBody> = {}): SimBody => ({
	name,
	parent: undefined,
	origin: new Matrix4(),
	joint: undefined,
	geoms: [],
	...overrides,
})

/** An opaque white geom at its body's origin that both draws and collides. */
export const simGeom = (shape: SimShape, overrides: Partial<SimGeom> = {}): SimGeom => ({
	shape,
	origin: new Matrix4(),
	rgba: [1, 1, 1, 1],
	role: 'visual-and-collision',
	...overrides,
})

/** A revolute joint about Z with ±90° limits, at `value` radians. */
export const revoluteJoint = (value: number): SimJoint => ({
	type: 'revolute',
	axis: new Vector3(0, 0, 1),
	lower: -Math.PI / 2,
	upper: Math.PI / 2,
	value,
	maxVelocity: undefined,
})

export const parseXml = (xml: string): Document =>
	new DOMParser().parseFromString(xml, 'application/xml')
