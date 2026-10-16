import { Matrix4 } from 'three'

import { Pose, type PosePatch } from '$lib/math'

const tempCenterPose = new Pose()
const tempCenterMatrix = new Matrix4()
const tempComposed = new Matrix4()

/**
 * The pose the details panel shows for an entity: its transform composed with
 * its geometry center. Drawn transforms, such as a frame system from the Go
 * `draw` package, often keep an identity pose and place the geometry through
 * its center alone, so the transform pose by itself reads as the origin.
 *
 * @param transform The entity's local or world matrix (m).
 * @param center The geometry center (mm) to fold in. Omit it for a reference
 *   frame, whose center offsets its geometry from the frame being described.
 * @returns `undefined` when there is neither a transform nor a center.
 */
export const composeDisplayedPose = (
	transform: Matrix4 | undefined,
	center: PosePatch | undefined
): Pose | undefined => {
	if (!transform) return center ? new Pose().copy(center) : undefined
	if (!center) return new Pose().setFromMatrix4(transform)

	tempCenterPose.copy(center).toMatrix4(tempCenterMatrix)
	return new Pose().setFromMatrix4(tempComposed.multiplyMatrices(transform, tempCenterMatrix))
}
