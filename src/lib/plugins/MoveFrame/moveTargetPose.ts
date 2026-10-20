import { MathUtils, Matrix4, Quaternion, Vector3 } from 'three'

import { Pose } from '$lib/math'

const inverseDestination = new Matrix4()
const localMatrix = new Matrix4()
const currentPosition = new Vector3()
const targetPosition = new Vector3()
const currentRotation = new Quaternion()
const targetRotation = new Quaternion()
const scratchScale = new Vector3()

const M_TO_MM = 1000

/**
 * Express a world-space target transform as a Viam `Pose`, in millimetres and
 * with an orientation vector whose `theta` is in degrees, relative to a
 * destination reference frame. This is what `MotionClient.move` expects
 * alongside the destination's name.
 *
 * Three.js matrices are metres, so `Pose` converts. Omit
 * `destinationWorldMatrix` when the destination is `world`, whose world
 * transform is the identity.
 */
export const toDestinationPose = (
	targetWorldMatrix: Matrix4,
	destinationWorldMatrix?: Matrix4
): Pose => {
	localMatrix.copy(targetWorldMatrix)

	if (destinationWorldMatrix) {
		inverseDestination.copy(destinationWorldMatrix).invert()
		localMatrix.premultiply(inverseDestination)
	}

	return new Pose().setFromMatrix4(localMatrix)
}

/**
 * Inverse of `toDestinationPose`: the world-space transform a `Pose` describes
 * relative to a destination reference frame. The panel's numeric inputs edit
 * the pose, while the gizmo and the ghosts read the matrix, so a typed or
 * dragged field round-trips back through here. Returns a new `Matrix4` because
 * the staged goal is held as `$state.raw` and replaced wholesale.
 */
export const fromDestinationPose = (pose: Pose, destinationWorldMatrix?: Matrix4): Matrix4 => {
	const worldMatrix = pose.toMatrix4()
	if (destinationWorldMatrix) worldMatrix.premultiply(destinationWorldMatrix)
	return worldMatrix
}

/** How far a staged move travels, for the panel readout. */
export interface MoveDelta {
	/** Straight-line translation, in millimetres. */
	distance: number
	/** Shortest rotation between the two orientations, in degrees. */
	angle: number
}

/**
 * The world-space difference between where the frame is now and where the gizmo
 * has staged it. Frame-relative units cancel out here, so this reads the same
 * whichever destination the move is expressed against.
 */
export const moveDelta = (currentWorldMatrix: Matrix4, targetWorldMatrix: Matrix4): MoveDelta => {
	currentWorldMatrix.decompose(currentPosition, currentRotation, scratchScale)
	targetWorldMatrix.decompose(targetPosition, targetRotation, scratchScale)

	return {
		distance: currentPosition.distanceTo(targetPosition) * M_TO_MM,
		angle: MathUtils.radToDeg(currentRotation.angleTo(targetRotation)),
	}
}
