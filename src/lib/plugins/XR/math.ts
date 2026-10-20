import { Quaternion, Vector3 } from 'three'

export function getFrameTransformationQuaternion(): Quaternion {
	// Matches the Dart implementation's frame transform.
	// 1: Rotate -90° around Z-axis
	const rotZ = new Quaternion().setFromAxisAngle(new Vector3(0, 0, 1), -Math.PI / 2)
	const rotX = new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), Math.PI / 2)

	// Combine: Apply rotX first, then rotZ
	return rotZ.multiply(rotX)
}

/**
 * The arm target position in the robot frame, in millimetres. The controller's movement
 * since the reference pose is rotated into the robot frame, scaled, and added to the
 * robot's reference position.
 */
export function calculatePositionTarget(
	currentControllerPos: Vector3,
	referenceControllerPos: Vector3,
	robotReferencePos: { x: number; y: number; z: number },
	qTransform: Quaternion,
	scaleFactor: number
) {
	const deltaXR = currentControllerPos.clone().sub(referenceControllerPos)

	const deltaRobot = deltaXR.clone().applyQuaternion(qTransform)

	const scaleMM = scaleFactor * 1000

	return {
		x: robotReferencePos.x + deltaRobot.x * scaleMM,
		y: robotReferencePos.y + deltaRobot.y * scaleMM,
		z: robotReferencePos.z + deltaRobot.z * scaleMM,
	}
}
