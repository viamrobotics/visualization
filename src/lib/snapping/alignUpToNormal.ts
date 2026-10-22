import { Quaternion, Vector3 } from 'three'

const up = new Vector3()
const tilt = new Quaternion()

/**
 * Tilts an orientation so its +Z points along `normal`, by the smallest rotation that does it.
 * Heading about the normal is kept, so a box set on a slanted shelf keeps facing the way it faced.
 *
 * @param normal A unit vector in world space.
 */
export const alignUpToNormal = (
	start: Quaternion,
	normal: Vector3,
	out: Quaternion
): Quaternion => {
	up.set(0, 0, 1).applyQuaternion(start)
	tilt.setFromUnitVectors(up, normal)
	return out.multiplyQuaternions(tilt, start)
}
