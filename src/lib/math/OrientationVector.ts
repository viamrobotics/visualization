import { Euler, MathUtils, Quaternion, Vector3 } from 'three'

export const EPSILON = 0.0001

const xAxis = new Quaternion(-1, 0, 0, 0)
const zAxis = new Quaternion(0, 0, +1, 0)

const quatA = new Quaternion()
const quatB = new Quaternion()
const quatC = new Quaternion()
const quatD = new Quaternion()
const quatE = new Quaternion()

const vecA = new Vector3()
const vecB = new Vector3()
const vecC = new Vector3()
const vecD = new Vector3()
const vecE = new Vector3()
const vecF = new Vector3()
const vecG = new Vector3()
const vecH = new Vector3()

type OrientationVectorLike = OrientationVector | { x: number; y: number; z: number; th: number }

/**
 * Viam’s orientation vector is a method for describing the orientation of an object in 3D space.
 * It is part of a Pose which also includes the position in 3D space.
 *
 * The vector extends from the center of the object to another point in the reference frame. This defines the direction something is pointing in.
 *
 * @see https://docs.viam.com/internals/orientation-vector/
 * @see https://github.com/viamrobotics/rdk/blob/main/spatialmath/orientationVector.go
 * @see https://github.com/viamrobotics/rust-utils/blob/main/src/spatialmath/utils.rs
 */
export class OrientationVector {
	readonly isOrientationVector = true

	#units: 'degrees' | 'radians' = 'radians'
	#vec = new Vector3()
	#th = 0

	#onChangeCallback: (() => void) | undefined

	autoNormalize = true

	constructor(x = 0, y = 0, z = 1, th = 0) {
		this.#vec.set(x, y, z)

		if (this.autoNormalize) {
			this.#normalize()
		}

		this.#th = th
	}

	/**
	 * Scales the vector to unit length, reading zero length as unset and
	 * substituting +Z — what rdk's `OrientationVector.Normalize` does.
	 */
	#normalize() {
		// A protobuf pose carrying only a position decodes to an all-zero vector,
		// which is identity to rdk but `acos(0)` — a quarter turn — to us.
		if (this.#vec.lengthSq() === 0) {
			this.#vec.set(0, 0, 1)
			return
		}

		this.#vec.normalize()
	}

	get units(): 'degrees' | 'radians' {
		return this.#units
	}

	get x(): number {
		return this.#vec.x
	}

	set x(value: number) {
		this.#vec.setX(value)

		if (this.autoNormalize) {
			this.#normalize()
		}

		this.#onChangeCallback?.()
	}

	get y(): number {
		return this.#vec.y
	}

	set y(value: number) {
		this.#vec.setY(value)

		if (this.autoNormalize) {
			this.#normalize()
		}

		this.#onChangeCallback?.()
	}

	/**
	 * The vector's z component.
	 * @default 1
	 */
	get z() {
		return this.#vec.z
	}

	set z(value: number) {
		this.#vec.setZ(value)

		if (this.autoNormalize) {
			this.#normalize()
		}

		this.#onChangeCallback?.()
	}

	/** Rotation about the vector, in the current `units`, radians unless `setUnits('degrees')` was called. */
	get th() {
		if (this.#units === 'degrees') {
			return MathUtils.radToDeg(this.#th)
		}
		return this.#th
	}

	set th(value: number) {
		this.#th = this.#units === 'degrees' ? MathUtils.degToRad(value) : value
		this.#onChangeCallback?.()
	}

	get w() {
		return this.th
	}

	set w(value: number) {
		this.th = value
	}

	_onChange(callback: () => void) {
		this.#onChangeCallback = callback
		return this
	}

	set(x = 0, y = 0, z = 0, th = 0): this {
		this.#vec.set(x, y, z)

		if (this.autoNormalize) {
			this.#normalize()
		}

		this.th = th

		this.#onChangeCallback?.()

		return this
	}

	setUnits(units: 'degrees' | 'radians'): this {
		this.#units = units

		return this
	}

	length(): number {
		return this.#vec.length()
	}

	normalize() {
		this.#normalize()
		return this
	}

	copy(ov: OrientationVectorLike): this {
		this.#vec.set(ov.x, ov.y, ov.z)

		if (this.autoNormalize) {
			this.#normalize()
		}

		this.th = ov.th

		this.#onChangeCallback?.()

		return this
	}

	equals(orientationVector: OrientationVectorLike) {
		return (
			this.x === orientationVector.x &&
			this.y === orientationVector.y &&
			this.z === orientationVector.z &&
			this.th === orientationVector.th
		)
	}

	fromArray(array: number[], offset = 0) {
		this.#vec.set(array[offset] ?? 0, array[offset + 1] ?? 0, array[offset + 2] ?? 0)
		this.th = array[offset + 3] ?? 0

		this.#onChangeCallback?.()

		return this
	}

	toArray(array: number[] = [], offset = 0) {
		array[offset] = this.x
		array[offset + 1] = this.y
		array[offset + 2] = this.z
		array[offset + 3] = this.th

		return array
	}

	toJson() {
		return this.toArray()
	}

	setFromQuaternion(quaternion: Quaternion): this {
		// Get the transform of our +X and +Z points
		const conj = quatA.copy(quaternion).conjugate()
		const newX = quatB.multiplyQuaternions(quaternion, xAxis).multiply(conj)
		const newZ = quatC.multiplyQuaternions(quaternion, zAxis).multiply(conj)

		let th = 0

		// EPSILON is not an angle here, but it is a convenient small number for testing how close the vector points to the pole.
		if (1 - Math.abs(newZ.z) > EPSILON) {
			const newZimag = vecA.set(newZ.x, newZ.y, newZ.z)
			const newXimag = vecB.set(newX.x, newX.y, newX.z)
			const zImagAxis = vecC.set(zAxis.x, zAxis.y, zAxis.z)

			// Get the vector normal to the local-x, local-z, origin plane
			const normal1 = vecD.copy(newZimag).cross(newXimag)

			// Get the vector normal to the global-z, local-z, origin plane
			const normal2 = vecE.copy(newZimag).cross(zImagAxis)

			// For theta, find the angle between the planes defined by local-x, global-z, origin and local-x, local-z, origin
			const cosThetaCand = normal1.dot(normal2) / (normal1.length() * normal2.length())
			const cosTheta = MathUtils.clamp(cosThetaCand, -1, 1)
			const theta = Math.acos(cosTheta)

			if (theta > EPSILON) {
				const newZImagUnit = vecF.copy(newZimag).normalize()
				const rotQuatUnit = quatD.setFromAxisAngle(newZImagUnit, -1 * theta)
				const conj2 = quatE.copy(rotQuatUnit).conjugate()
				const testZ = rotQuatUnit.multiplyQuaternions(rotQuatUnit.multiply(zAxis), conj2)
				const normal3 = vecG.copy(newZimag).cross(vecH.set(testZ.x, testZ.y, testZ.z))
				const cosTest = normal1.dot(normal3) / (normal1.length() * normal3.length())
				th = 1 - cosTest < EPSILON ** 2 ? -theta : theta
			} else {
				th = 0
			}
		} else if (newZ.z < 0) {
			// Pointing straight along Z: theta comes from the local-x, global-z, origin plane instead.
			th = -Math.atan2(newX.y, newX.x)
		} else {
			th = -Math.atan2(newX.y, -newX.x)
		}

		this.set(newZ.x, newZ.y, newZ.z, th)

		this.#onChangeCallback?.()

		return this
	}

	toQuaternion(dest: Quaternion): Quaternion {
		const lat = Math.acos(this.z)
		const lon = 1 - Math.abs(this.z) > EPSILON ? Math.atan2(this.y, this.x) : 0
		const s0 = Math.sin(lon / 2)
		const c0 = Math.cos(lon / 2)
		const s1 = Math.sin(lat / 2)
		const c1 = Math.cos(lat / 2)
		const s2 = Math.sin(this.th / 2)
		const c2 = Math.cos(this.th / 2)

		return dest.set(
			c0 * s1 * s2 - s0 * s1 * c2,
			c0 * s1 * c2 + s0 * s1 * s2,
			s0 * c1 * c2 + c0 * c1 * s2,
			c0 * c1 * c2 - s0 * c1 * s2
		)
	}

	toEuler(dest: Euler) {
		return dest.setFromQuaternion(this.toQuaternion(quatA), 'ZYX')
	}
}
