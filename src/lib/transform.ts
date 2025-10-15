import type { Geometry, Pose } from '@viamrobotics/sdk'
import { OrientationVector } from './three/OrientationVector'
import { type Object3D, MathUtils, Quaternion, Vector3 } from 'three'

const ov = new OrientationVector()

export const createPose = (pose?: Pose): Pose => {
	return {
		x: pose?.x ?? 0,
		y: pose?.y ?? 0,
		z: pose?.z ?? 0,
		oX: pose?.oX ?? 0,
		oY: pose?.oY ?? 0,
		oZ: pose?.oZ ?? 1,
		theta: pose?.theta ?? 0,
	}
}

export const createGeometry = (geometryType?: Geometry['geometryType'], label = ''): Geometry => {
	return {
		center: createPose(),
		label,
		geometryType: geometryType ?? { case: undefined, value: undefined },
	}
}

export const quaternionToPose = (quaternion: Quaternion, pose: Partial<Pose>) => {
	ov.setFromQuaternion(quaternion)
	pose.oX = ov.x
	pose.oY = ov.y
	pose.oZ = ov.z
	pose.theta = MathUtils.radToDeg(ov.th)
}

export const vector3ToPose = (vec3: Vector3, pose: Partial<Pose>) => {
	pose.x = vec3.x * 1000
	pose.y = vec3.y * 1000
	pose.z = vec3.z * 1000
}

export const object3dToPose = (object3d: Object3D, pose: Partial<Pose>) => {
	vector3ToPose(object3d.position, pose)
	quaternionToPose(object3d.quaternion, pose)
	return pose
}

export const poseToQuaternion = (pose: Partial<Pose>, quaternion: Quaternion) => {
	const th = MathUtils.degToRad(pose.theta ?? 0)
	ov.set(pose.oX, pose.oY, pose.oZ, th)
	ov.toQuaternion(quaternion)
}

export const poseToVector3 = (pose: Partial<Pose>, vec3: Vector3) => {
	vec3.set(pose.x ?? 0, pose.y ?? 0, pose.z ?? 0).multiplyScalar(0.001)
}

export const poseToObject3d = (pose: Partial<Pose>, object3d: Object3D) => {
	poseToVector3(pose, object3d.position)
	poseToQuaternion(pose, object3d.quaternion)
}

export const poseToDirection = (pose: Pose): Vector3 => {
	const ov = new OrientationVector(pose.oX, pose.oY, pose.oZ, pose.theta)
	return new Vector3(ov.x, ov.y, ov.z)
}

export const scaleToDimensions = (scale: Vector3, geometry: Geometry['geometryType']) => {
	if (geometry.case === 'box') {
		geometry.value.dimsMm ??= { x: 0, y: 0, z: 0 }
		geometry.value.dimsMm.x *= scale.x
		geometry.value.dimsMm.y *= scale.y
		geometry.value.dimsMm.z *= scale.z
	} else if (geometry.case === 'capsule') {
		geometry.value.radiusMm *= scale.x
		geometry.value.lengthMm *= scale.y
	} else if (geometry.case === 'sphere') {
		geometry.value.radiusMm *= scale.x
	}
}
