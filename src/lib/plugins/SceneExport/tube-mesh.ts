import { type BufferGeometry, CylinderGeometry } from 'three'

const RADIAL_SEGMENTS = 24
const HEIGHT_SEGMENTS = 1
const IS_OPEN_ENDED = true

/**
 * An open-ended cylinder as a triangle mesh, since neither URDF nor MJCF has an uncapped primitive.
 * three builds cylinders along Y, and Viam's lie along Z.
 */
export const tubeMesh = (radius: number, length: number): BufferGeometry =>
	new CylinderGeometry(
		radius,
		radius,
		length,
		RADIAL_SEGMENTS,
		HEIGHT_SEGMENTS,
		IS_OPEN_ENDED
	).rotateX(Math.PI / 2)
