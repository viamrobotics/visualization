import { Quaternion, Vector3 } from 'three';

export function getFrameTransformationQuaternion(): Quaternion {
  // MATCHING DART IMPLEMENTATION EXACTLY:
  // 1: Rotate -90° around Z-axis
  const rotZ = new Quaternion().setFromAxisAngle(new Vector3(0, 0, 1), -Math.PI / 2);
  // 2: Rotate 90° around X-axis
  const rotX = new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), Math.PI / 2);

  // Combine: Apply rotX first, then rotZ
  return rotZ.multiply(rotX);
}

/**
 * Calculates the delta position in Robot Frame
 */
export function calculatePositionTarget(
  currentControllerPos: Vector3,
  referenceControllerPos: Vector3,
  robotReferencePos: { x: number, y: number, z: number },
  qTransform: Quaternion,
  scaleFactor: number
) {
  // 1. Get delta in VR space (Meters)
  const deltaVR = currentControllerPos.clone().sub(referenceControllerPos);
  
  // 2. Convert to Robot Frame
  const deltaRobot = deltaVR.clone().applyQuaternion(qTransform);
  
  // 3. Scale (Meters -> Millimeters) and Apply
  const scaleMM = scaleFactor * 1000;
  
  return {
    x: robotReferencePos.x + (deltaRobot.x * scaleMM),
    y: robotReferencePos.y + (deltaRobot.y * scaleMM),
    z: robotReferencePos.z + (deltaRobot.z * scaleMM)
  };
}
