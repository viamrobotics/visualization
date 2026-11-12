import { Quaternion } from 'three'
import { expect } from 'vitest'

/** A quaternion as the Go golden generators write it. */
export interface GoldenQuaternion {
	w: number
	x: number
	y: number
	z: number
}

/** `quatCompare` in RDK's own spatialmath/quat_test.go holds two quaternions equal to 1e-8. */
const QUATERNION_PLACES = 8

/** `q` and `-q` are the same rotation, so the expected quaternion is compared in whichever sign sits nearer `actual`. */
export const expectSameRotation = (actual: Quaternion, expected: GoldenQuaternion) => {
	const q = new Quaternion(expected.x, expected.y, expected.z, expected.w)
	const sign = actual.dot(q) < 0 ? -1 : 1

	expect(actual.x).toBeCloseTo(sign * q.x, QUATERNION_PLACES)
	expect(actual.y).toBeCloseTo(sign * q.y, QUATERNION_PLACES)
	expect(actual.z).toBeCloseTo(sign * q.z, QUATERNION_PLACES)
	expect(actual.w).toBeCloseTo(sign * q.w, QUATERNION_PLACES)
}
