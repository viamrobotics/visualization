import type { Pose as ViamPose } from '@viamrobotics/sdk'

import { Euler, MathUtils, Matrix4, Object3D, Quaternion, Vector3 } from 'three'

import type { Frame } from '../frame'

import { quatFromJson } from './orientationJson'
import { OrientationVector } from './OrientationVector'

const ov = new OrientationVector()
const quaternion = new Quaternion()
const translation = new Vector3()
const scale = new Vector3()
const euler = new Euler()

/**
 * A `Pose` is always in millimetres with `theta` in degrees — the units the
 * Viam APIs and the machine config speak. Three.js scene graph objects
 * (`Matrix4`, `Vector3`, `Object3D`) are always in metres, so every method
 * that crosses that boundary converts. Callers never scale by hand.
 */
const MM_TO_M = 0.001
const M_TO_MM = 1000

/** Every field optional — the shape of a partial or wire-decoded pose. */
export interface PosePatch {
	x?: number
	y?: number
	z?: number
	oX?: number
	oY?: number
	oZ?: number
	theta?: number
}

export class Pose implements ViamPose {
	x: number
	y: number
	z: number
	oX: number
	oY: number
	oZ: number
	theta: number

	constructor(x = 0, y = 0, z = 0, oX?: number, oY?: number, oZ?: number, theta = 0) {
		this.x = x
		this.y = y
		this.z = z
		this.oX = oX ?? 0
		this.oY = oY ?? 0
		this.theta = theta

		// Only default to the 0,0,1,0 orientation vector if the entire vector component
		// is missing — a caller who supplies any axis means the omitted ones to be zero.
		this.oZ = oX === undefined && oY === undefined && oZ === undefined ? 1 : (oZ ?? 0)
	}

	equals(pose?: PosePatch) {
		if (pose === this) return true
		if (!pose) return false

		return (
			this.x === pose.x &&
			this.y === pose.y &&
			this.z === pose.z &&
			this.oX === pose.oX &&
			this.oY === pose.oY &&
			this.oZ === pose.oZ &&
			this.theta === pose.theta
		)
	}

	clone() {
		return new Pose(this.x, this.y, this.z, this.oX, this.oY, this.oZ, this.theta)
	}

	/**
	 * Overwrite every field from `pose`, defaulting the ones it omits. Passing
	 * `undefined` resets to the identity pose rather than leaving the previous
	 * values in place — call sites copy from optional wire fields
	 * (`poseInObserverFrame?.pose`) into reused scratch poses, and a no-op would
	 * silently carry the last entity's pose forward. Use `merge` to patch.
	 */
	copy(pose?: PosePatch) {
		this.x = pose?.x ?? 0
		this.y = pose?.y ?? 0
		this.z = pose?.z ?? 0
		this.oX = pose?.oX ?? 0
		this.oY = pose?.oY ?? 0
		this.theta = pose?.theta ?? 0

		this.oZ =
			pose?.oX === undefined && pose?.oY === undefined && pose?.oZ === undefined
				? 1
				: (pose?.oZ ?? 0)

		return this
	}

	/** Overwrite only the fields `patch` defines, leaving the rest untouched. */
	merge(patch: PosePatch) {
		if (patch.x !== undefined) this.x = patch.x
		if (patch.y !== undefined) this.y = patch.y
		if (patch.z !== undefined) this.z = patch.z
		if (patch.oX !== undefined) this.oX = patch.oX
		if (patch.oY !== undefined) this.oY = patch.oY
		if (patch.oZ !== undefined) this.oZ = patch.oZ
		if (patch.theta !== undefined) this.theta = patch.theta

		return this
	}

	isFinite() {
		return (
			Number.isFinite(this.x) &&
			Number.isFinite(this.y) &&
			Number.isFinite(this.z) &&
			Number.isFinite(this.oX) &&
			Number.isFinite(this.oY) &&
			Number.isFinite(this.oZ) &&
			Number.isFinite(this.theta)
		)
	}

	setFromFrame(frame: Partial<Frame>) {
		const orientation = frame.orientation

		// Stored configs can contain the orientation discriminator without its
		// value (for example after a partial frame edit is discarded). Treat that
		// wire-level default the same as an omitted orientation.
		if (!orientation?.value) {
			ov.set(0, 0, 1, 0)
		} else if (orientation.type === 'ov_degrees' || orientation.type === 'ov_radians') {
			// Read across directly: a quaternion round trip is exact for the rotation
			// but not the tuple, and `th: 180` returning as `-180` would change what
			// the config round-trips.
			const { x, y, z, th } = orientation.value
			ov.set(x, y, z, orientation.type === 'ov_radians' ? th : MathUtils.degToRad(th ?? 0))
		} else {
			quatFromJson(orientation, quaternion)
			ov.setFromQuaternion(quaternion)
		}

		// Frame translations come from the machine config, already in millimetres.
		this.x = frame.translation?.x ?? 0
		this.y = frame.translation?.y ?? 0
		this.z = frame.translation?.z ?? 0
		this.oX = ov.x
		this.oY = ov.y
		this.oZ = ov.z
		this.theta = MathUtils.radToDeg(ov.th)

		return this
	}

	setFromQuaternion(quaternion: Quaternion) {
		ov.setFromQuaternion(quaternion)
		this.oX = ov.x
		this.oY = ov.y
		this.oZ = ov.z
		this.theta = MathUtils.radToDeg(ov.th)

		return this
	}

	/** Read a position from a `Vector3` (m), storing it as millimetres. */
	setFromVector3(vector3: Vector3) {
		this.x = vector3.x * M_TO_MM
		this.y = vector3.y * M_TO_MM
		this.z = vector3.z * M_TO_MM

		return this
	}

	setFromObject3D(object3D: Object3D) {
		this.setFromVector3(object3D.position)
		this.setFromQuaternion(object3D.quaternion)

		return this
	}

	/** Decompose a `Matrix4` (m) into this pose (mm). */
	setFromMatrix4(matrix4: Matrix4) {
		matrix4.decompose(translation, quaternion, scale)
		this.x = translation.x * M_TO_MM
		this.y = translation.y * M_TO_MM
		this.z = translation.z * M_TO_MM

		ov.setFromQuaternion(quaternion)
		this.oX = ov.x
		this.oY = ov.y
		this.oZ = ov.z
		this.theta = MathUtils.radToDeg(ov.th)

		return this
	}

	/** Build a TR `Matrix4` (m) from this pose (mm). */
	toMatrix4(matrix4 = new Matrix4()) {
		ov.set(this.oX, this.oY, this.oZ, MathUtils.degToRad(this.theta))
		ov.toQuaternion(quaternion)
		matrix4.makeRotationFromQuaternion(quaternion)
		matrix4.setPosition(this.x * MM_TO_M, this.y * MM_TO_M, this.z * MM_TO_M)
		return matrix4
	}

	toQuaternion(quaternion = new Quaternion()) {
		ov.set(this.oX, this.oY, this.oZ, MathUtils.degToRad(this.theta))
		ov.toQuaternion(quaternion)
		return quaternion
	}

	toEulerDegrees() {
		this.toQuaternion(quaternion)
		euler.setFromQuaternion(quaternion, 'ZYX')
		return {
			roll: MathUtils.radToDeg(euler.x),
			pitch: MathUtils.radToDeg(euler.y),
			yaw: MathUtils.radToDeg(euler.z),
		}
	}

	/** Write this pose's position (mm) into a `Vector3` (m). */
	toVector3(vector3 = new Vector3()) {
		vector3.set(this.x * MM_TO_M, this.y * MM_TO_M, this.z * MM_TO_M)
		return vector3
	}

	toObject3D(object3D = new Object3D()) {
		this.toQuaternion(object3D.quaternion)
		this.toVector3(object3D.position)
		return object3D
	}
}
