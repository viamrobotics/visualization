import { Quaternion, Vector3 } from 'three'

export function getFrameTransformationQuaternion(): Quaternion {
	// MATCHING DART IMPLEMENTATION EXACTLY:
	// 1: Rotate -90° around Z-axis
	const rotZ = new Quaternion().setFromAxisAngle(new Vector3(0, 0, 1), -Math.PI / 2)
	// 2: Rotate 90° around X-axis
	const rotX = new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), Math.PI / 2)

	// Combine: Apply rotX first, then rotZ
	return rotZ.multiply(rotX)
}

export function getSteamVRFrameTransformationQuaternion(): Quaternion {
	// OpenVR standing universe → robot frame (Viam: X=forward, Y=left, Z=up).
	// Without room calibration the standing universe is anchored to the HMD's
	// initial facing direction.  Empirically derived mapping:
	//   Room +Y → Robot +Z  (up ✓)
	//   Room -Z → Robot -Y  (operator's right → robot right)
	//   Room +Z → Robot +Y  (operator's left → robot left)
	//   Room -X → Robot +X  (operator forward → robot forward)
	//   Room +X → Robot -X  (operator backward → robot backward)
	// rotX(90°) then rotZ(180°): first swap Y↔Z, then negate X and Y.
	const rotX = new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), Math.PI / 2)
	const rotZ = new Quaternion().setFromAxisAngle(new Vector3(0, 0, 1), Math.PI)
	return rotZ.multiply(rotX) // apply rotX first, then rotZ
}

/**
 * Calculates the delta position in Robot Frame
 */
export function calculatePositionTarget(
	currentControllerPos: Vector3,
	referenceControllerPos: Vector3,
	robotReferencePos: { x: number; y: number; z: number },
	qTransform: Quaternion,
	scaleFactor: number
) {
	// 1. Get delta in XR space (Meters)
	const deltaXR = currentControllerPos.clone().sub(referenceControllerPos)

	// 2. Convert to Robot Frame
	const deltaRobot = deltaXR.clone().applyQuaternion(qTransform)

	// 3. Scale (Meters -> Millimeters) and Apply
	const scaleMM = scaleFactor * 1000

	return {
		x: robotReferencePos.x + deltaRobot.x * scaleMM,
		y: robotReferencePos.y + deltaRobot.y * scaleMM,
		z: robotReferencePos.z + deltaRobot.z * scaleMM,
	}
}
