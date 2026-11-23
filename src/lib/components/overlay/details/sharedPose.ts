import { Euler, MathUtils, Quaternion } from 'three'

import type { Pose } from '#lib/math/index.js'

import { OrientationVector } from '#lib/math/OrientationVector.js'

import { MIXED, type Shared, sharedNumber } from './sharedValue'

/** Smallest angle, in radians, between two orientations that still reads as one. */
const ANGLE_TOLERANCE = 1e-6

const ovUtil = new OrientationVector()
const firstQuaternion = new Quaternion()
const otherQuaternion = new Quaternion()
const eulerUtil = new Euler()

/** A pose across a selection, each field shared or mixed on its own. */
export interface SharedPose {
	x: Shared<number>
	y: Shared<number>
	z: Shared<number>
	oX: Shared<number>
	oY: Shared<number>
	oZ: Shared<number>
	theta: Shared<number>
}

/** A pose with every field mixed, for a selection where some entities have no pose to compare. */
export const MIXED_POSE: Readonly<SharedPose> = {
	x: MIXED,
	y: MIXED,
	z: MIXED,
	oX: MIXED,
	oY: MIXED,
	oZ: MIXED,
	theta: MIXED,
}

/** Euler angles in degrees across a selection, in the `ZYX` order the details panel edits. */
export interface SharedEuler {
	x: Shared<number>
	y: Shared<number>
	z: Shared<number>
}

/** Writes the pose's orientation into `dest` as a quaternion. */
export const orientationQuaternion = (pose: Pose, dest: Quaternion): Quaternion =>
	ovUtil.set(pose.oX, pose.oY, pose.oZ, MathUtils.degToRad(pose.theta)).toQuaternion(dest)

/** The pose's orientation as `ZYX` Euler angles in degrees. */
export const orientationEuler = (pose: Pose): { x: number; y: number; z: number } => {
	eulerUtil.setFromQuaternion(orientationQuaternion(pose, firstQuaternion), 'ZYX')
	return {
		x: MathUtils.radToDeg(eulerUtil.x),
		y: MathUtils.radToDeg(eulerUtil.y),
		z: MathUtils.radToDeg(eulerUtil.z),
	}
}

/**
 * Whether every pose has the same rotation. Compared as quaternions, since one rotation
 * has several orientation vector spellings, such as `theta` 180 and -180.
 */
const isOrientationShared = (poses: readonly Pose[]): boolean => {
	const [first, ...rest] = poses
	if (!first) return true

	orientationQuaternion(first, firstQuaternion)
	return rest.every(
		(pose) =>
			orientationQuaternion(pose, otherQuaternion).angleTo(firstQuaternion) <= ANGLE_TOLERANCE
	)
}

/**
 * Collapses the selection's poses field by field. When every rotation matches, the
 * first pose's orientation is shown whole, so a spelling difference never reads as mixed.
 *
 * @param poses One per selected entity. Never empty.
 */
export const sharedPose = (poses: readonly Pose[]): SharedPose => {
	const field = (key: keyof SharedPose) => sharedNumber(poses.map((pose) => pose[key]))

	const position: Pick<SharedPose, 'x' | 'y' | 'z'> = {
		x: field('x'),
		y: field('y'),
		z: field('z'),
	}
	const first = poses[0]

	if (first && isOrientationShared(poses)) {
		return { ...position, oX: first.oX, oY: first.oY, oZ: first.oZ, theta: first.theta }
	}

	return { ...position, oX: field('oX'), oY: field('oY'), oZ: field('oZ'), theta: field('theta') }
}

/**
 * The selection's orientations as `ZYX` Euler angles, collapsed angle by angle. When
 * every rotation matches, the first pose's angles are shown whole.
 *
 * @param poses One per selected entity. Never empty.
 */
export const sharedEuler = (poses: readonly Pose[]): SharedEuler => {
	const eulers = poses.map((pose) => orientationEuler(pose))
	const first = eulers[0]

	if (first && isOrientationShared(poses)) return first

	return {
		x: sharedNumber(eulers.map((angles) => angles.x)),
		y: sharedNumber(eulers.map((angles) => angles.y)),
		z: sharedNumber(eulers.map((angles) => angles.z)),
	}
}
