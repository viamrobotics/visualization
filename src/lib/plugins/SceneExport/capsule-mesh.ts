import { type BufferGeometry, CapsuleGeometry } from 'three'

const CAP_SEGMENTS = 8
const RADIAL_SEGMENTS = 24

/**
 * A capsule as a triangle mesh, for formats with no capsule primitive. `length` includes both caps,
 * as Viam measures it. three builds capsules along Y, and Viam's lie along Z.
 */
export const capsuleMesh = (radius: number, length: number): BufferGeometry =>
	new CapsuleGeometry(
		radius,
		Math.max(length - 2 * radius, 0),
		CAP_SEGMENTS,
		RADIAL_SEGMENTS
	).rotateX(Math.PI / 2)
