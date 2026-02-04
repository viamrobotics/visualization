import { Quaternion, Vector3 } from 'three';

// Viam Orientation Vector type
export interface OrientationVector {
  x: number;
  y: number;
  z: number;
  theta: number;
}

export function getFrameTransformationQuaternion(): Quaternion {
  // STRICTLY MATCHING DART IMPLEMENTATION:
  // 1: Rotate -90° around Z-axis
  const rotZ = new Quaternion().setFromAxisAngle(new Vector3(0, 0, 1), -Math.PI / 2);
  // 2: Rotate 90° around X-axis
  const rotX = new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), Math.PI / 2);
  
  // Combine: Apply rotX first, then rotZ
  return rotZ.multiply(rotX);
}

/**
 * Convert Viam OrientationVector (Axis-Angle) to Three.js Quaternion
 */
export function orientationVectorToQuaternion(ov: OrientationVector): Quaternion {
  const axis = new Vector3(ov.x, ov.y, ov.z);
  const axisLength = axis.length();

  // Handle zero-length axis (identity rotation)
  if (axisLength < 0.0001) {
    return new Quaternion(); // Identity quaternion (0, 0, 0, 1)
  }

  axis.normalize();
  return new Quaternion().setFromAxisAngle(axis, ov.theta);
}

/**
 * Convert Three.js Quaternion to Viam OrientationVector
 * Handles singularities where the axis might be undefined or ambiguous.
 */
export function quaternionToOrientationVector(q: Quaternion): OrientationVector {
  // Normalize the quaternion to ensure valid rotation properties
  const qNormalized = q.clone().normalize();
  
  // Ensure canonical formulation (w >= 0) to avoid "long way around" rotations
  if (qNormalized.w < 0) {
    qNormalized.x *= -1;
    qNormalized.y *= -1;
    qNormalized.z *= -1;
    qNormalized.w *= -1;
  }
  
  // Three.js doesn't expose axis/angle directly in a simple property, 
  // but we can extract it.
  // 2 * acos(w) is the angle.
  // Axis is (x, y, z) / sin(angle/2)

  const angle = 2 * Math.acos(qNormalized.w);
  const sinHalfAngle = Math.sqrt(1 - qNormalized.w * qNormalized.w);

  let x = 0;
  let y = 0;
  let z = 0;

  if (sinHalfAngle < 0.001) {
    // Angle is effectively 0 (or close to 0), so axis is arbitrary.
    // We can pick Z axis by default for Viam convention or just return 0,0,1
    x = 0;
    y = 0;
    z = 1;
  } else {
    x = qNormalized.x / sinHalfAngle;
    y = qNormalized.y / sinHalfAngle;
    z = qNormalized.z / sinHalfAngle;
  }

  return { x, y, z, theta: angle };
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
