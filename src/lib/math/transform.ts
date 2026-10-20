import { Euler, MathUtils, Matrix4, Quaternion } from 'three'

import type { Pose } from './pose'

const quaternion = new Quaternion()
const euler = new Euler()
const matA = new Matrix4()

/**
 * Write `pose`'s orientation into `out` with the given ZYX Euler angles
 * (degrees) substituted in.
 *
 * Each angle is an absolute replacement, not a rotation composed onto what's
 * there: the base orientation only survives in the channels `angles` leaves
 * out, which is what lets a control edit one axis without disturbing the other
 * two. `out` may be `pose`.
 */
export const setOrientationFromEuler = (
	pose: Pose,
	angles: { roll?: number; pitch?: number; yaw?: number },
	out: Pose
): void => {
	pose.toQuaternion(quaternion)
	euler.setFromQuaternion(quaternion, 'ZYX')

	if (angles.roll !== undefined) euler.x = MathUtils.degToRad(angles.roll)
	if (angles.pitch !== undefined) euler.y = MathUtils.degToRad(angles.pitch)
	if (angles.yaw !== undefined) euler.z = MathUtils.degToRad(angles.yaw)

	quaternion.setFromEuler(euler)
	out.setFromQuaternion(quaternion)
}

export const composeLocalMatrix = (
	live: Matrix4,
	baseline: Matrix4,
	edited: Matrix4,
	out: Matrix4
): Matrix4 => {
	matA.copy(baseline).invert()
	out.copy(live).multiply(matA).multiply(edited)
	return out
}

/**
 * Inverse of `composeLocalMatrix` for the transform controls path:
 * writes `baseline × live⁻¹ × target` into `out`. Solves for the
 * `EditedMatrix` that, blended through `composeLocalMatrix`, renders
 * to `target`.
 */
export const solveEditedMatrix = (
	baseline: Matrix4,
	live: Matrix4,
	target: Matrix4,
	out: Matrix4
): Matrix4 => {
	matA.copy(live).invert()
	out.copy(baseline).multiply(matA).multiply(target)
	return out
}
