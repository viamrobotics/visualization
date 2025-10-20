import type { Geometry, Pose } from '@viamrobotics/sdk'
import { OrientationVector } from './three/OrientationVector'
import { type Object3D, Euler, MathUtils, Matrix4, Quaternion, Vector3 } from 'three'
import type { Frame } from './frame'

const quaternion = new Quaternion()
const euler = new Euler()
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

export const createPoseFromFrame = (frame: Frame): Pose => {
	if (frame.orientation.type === 'quaternion') {
		quaternion.copy(frame.orientation.value)
		ov.setFromQuaternion(quaternion)
	} else if (frame.orientation.type === 'euler_angles') {
		euler.set(
			frame.orientation.value.roll,
			frame.orientation.value.pitch,
			frame.orientation.value.yaw,
			'ZYX'
		)
		quaternion.setFromEuler(euler)
		ov.setFromQuaternion(quaternion)
	} else if (frame.orientation.type === 'ov_radians') {
		ov.copy(frame.orientation.value)
	} else if (frame.orientation.type === 'ov_degrees') {
		const th = MathUtils.degToRad(frame.orientation.value.th)
		ov.set(frame.orientation.value.x, frame.orientation.value.y, frame.orientation.value.z, th)
	}

	return {
		x: frame.translation.x ?? 0,
		y: frame.translation.y ?? 0,
		z: frame.translation.z ?? 0,
		oX: ov.x,
		oY: ov.y,
		oZ: ov.z,
		theta: MathUtils.radToDeg(ov.th),
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
	ov.set(pose.oX, pose.oY, pose.oZ, MathUtils.degToRad(pose.theta))
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

export const poseToMatrix = (pose: Pose) => {
	const matrix = new Matrix4()
	const poseQuaternion = new Quaternion().setFromAxisAngle(
		new Vector3(pose.oX, pose.oY, pose.oZ),
		pose.theta * (Math.PI / 180)
	)
	matrix.makeRotationFromQuaternion(poseQuaternion)
	matrix.setPosition(new Vector3(pose.x, pose.y, pose.z))
	return matrix
}

export const matrixToPose = (matrix: Matrix4) => {
	const pose = createPose()
	const translation = new Vector3()
	const quaternion = new Quaternion()
	matrix.decompose(translation, quaternion, new Vector3())
	pose.x = translation.x
	pose.y = translation.y
	pose.z = translation.z

	const s = Math.sqrt(1 - quaternion.w * quaternion.w)
	if (s < 0.000001) {
		pose.oX = 0
		pose.oY = 0
		pose.oZ = 1
		pose.theta = 0
	} else {
		pose.oX = quaternion.x / s
		pose.oY = quaternion.y / s
		pose.oZ = quaternion.z / s
		pose.theta = Math.acos(quaternion.w) * 2 * (180 / Math.PI)
	}

	return pose
}
