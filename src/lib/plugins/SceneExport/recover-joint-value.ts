import { Matrix4, Quaternion, Vector3 } from 'three'

import type { SimJoint } from './sim-scene'

/**
 * How far a pose may stray from what the joint alone could produce and still be read as that joint.
 * Well above float noise in rdk's millimetre poses, well below anything a viewer would show.
 */
const POSITION_TOLERANCE_M = 1e-4
const ANGLE_TOLERANCE_RAD = 1e-3

const jointMotion = new Matrix4()
const rotation = new Quaternion()
const translation = new Vector3()
const scale = new Vector3()
const offAxis = new Vector3()

/** The rotation angle of `quaternion`, in radians, from 0 to π. */
const angleOf = (quaternion: Quaternion): number =>
	2 * Math.atan2(Math.hypot(quaternion.x, quaternion.y, quaternion.z), Math.abs(quaternion.w))

/**
 * The joint position that turns `childStatic` into `childInParent`. rdk composes a child of a joint
 * as `joint(value) × childStatic`, so the joint's own motion is what is left once the static part is
 * removed.
 *
 * Returns `undefined` when what is left is not motion this joint can make: a revolute joint that
 * also translated, or turned about another axis. That happens when the pose was not measured through
 * the joint, such as a config pose read before any `getPose` poll.
 */
export const recoverJointValue = (
	{ type, axis }: Pick<SimJoint, 'type' | 'axis'>,
	childInParent: Matrix4,
	childStatic: Matrix4
): number | undefined => {
	jointMotion.copy(childStatic).invert().premultiply(childInParent)
	jointMotion.decompose(translation, rotation, scale)

	if (type === 'prismatic') {
		const value = translation.dot(axis)
		offAxis.copy(axis).multiplyScalar(value).sub(translation)
		const isAlongAxis = offAxis.length() < POSITION_TOLERANCE_M
		return isAlongAxis && angleOf(rotation) < ANGLE_TOLERANCE_RAD ? value : undefined
	}

	const sinHalfAlongAxis = rotation.x * axis.x + rotation.y * axis.y + rotation.z * axis.z
	offAxis.set(rotation.x, rotation.y, rotation.z).addScaledVector(axis, -sinHalfAlongAxis)
	const isAboutAxis = 2 * Math.asin(Math.min(offAxis.length(), 1)) < ANGLE_TOLERANCE_RAD
	if (!isAboutAxis || translation.length() >= POSITION_TOLERANCE_M) return undefined

	return 2 * Math.atan2(sinHalfAlongAxis, rotation.w)
}
