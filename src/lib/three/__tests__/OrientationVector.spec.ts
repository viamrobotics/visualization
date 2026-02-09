import { expect, describe, it } from 'vitest'
import { Quaternion, Vector3 } from 'three'
import { OrientationVector, EPSILON } from '../OrientationVector'

const vecA = new Vector3()
const vecB = new Vector3()

const quatAppxEqual = (q1: Quaternion, q2: Quaternion) => {
	return (
		Math.abs(q1.x) - Math.abs(q2.x) < EPSILON &&
		Math.abs(q1.y) - Math.abs(q2.y) < EPSILON &&
		Math.abs(q1.z) - Math.abs(q2.z) < EPSILON &&
		Math.abs(q1.w) - Math.abs(q2.w) < EPSILON
	)
}

const numAppxEqual = (a: number, b: number) => {
	return Math.abs(a - b) < EPSILON
}

const ovAppxEqual = (ov1: OrientationVector, ov2: OrientationVector) => {
	const vecDiff = vecA.set(ov1.x, ov1.y, ov1.z).sub(vecB.set(ov2.x, ov2.y, ov2.z))

	return Math.abs(vecDiff.lengthSq()) < EPSILON && Math.abs(ov1.th) - Math.abs(ov2.th) < EPSILON
}

describe('OrientationVector', () => {
	const ov = new OrientationVector()
	const expectedQuat = new Quaternion()
	const actualQuat = new Quaternion()

	it('converts an orientation vector to a quaternion', () => {
		ov.set(0, -1, 0, 1.570_796_326_794_896_6)
		expectedQuat.set(0.707_106_781_186_547_6, 0, 0, 0.707_106_781_186_547_6)
		expect(quatAppxEqual(expectedQuat, ov.toQuaternion(actualQuat))).toBe(true)

		ov.set(0, 1, 0, -1.570_796_326_794_896_6)
		expectedQuat.set(-0.707_106_781_186_547_6, 0, 0, 0.707_106_781_186_547_6)
		expect(quatAppxEqual(expectedQuat, ov.toQuaternion(actualQuat))).toBe(true)

		ov.set(-0.5376, 0, 0.8432, -1 * Math.PI)
		expectedQuat.set(0, -0.28, 0, 0.96)
		expect(quatAppxEqual(expectedQuat, ov.toQuaternion(actualQuat))).toBe(true)

		ov.set(0, 0, 1, -0.567_588_218_416_655_7)
		expectedQuat.set(0, 0, -0.28, 0.96)
		expect(quatAppxEqual(expectedQuat, ov.toQuaternion(actualQuat))).toBe(true)

		ov.set(0, 0.5376, 0.8432, -1.570_796_326_794_896_6)
		expectedQuat.set(-0.28, 0, 0, 0.96)
		expect(quatAppxEqual(expectedQuat, ov.toQuaternion(actualQuat))).toBe(true)

		ov.set(0, -0.5376, 0.8432, 1.570_796_326_794_896_6)
		expectedQuat.set(0.28, 0, 0, 0.96)
		expect(quatAppxEqual(expectedQuat, ov.toQuaternion(actualQuat))).toBe(true)

		ov.set(0, 1, 0, -1 * Math.PI)
		expectedQuat.set(-0.5, -0.5, -0.5, 0.5)
		expect(quatAppxEqual(expectedQuat, ov.toQuaternion(actualQuat))).toBe(true)

		ov.set(0.504_843_794_294_005_4, 0.588_984_426_676_339_7, 0.631_054_742_867_507, 0.02)
		expectedQuat.set(
			-0.175_559_660_254_131_42,
			0.391_983_971_939_798_17,
			0.385_537_548_516_400_1,
			0.816_632_212_270_443
		)
		expect(quatAppxEqual(expectedQuat, ov.toQuaternion(actualQuat))).toBe(true)
	})

	const quaternion = new Quaternion()
	const expectedOv = new OrientationVector()
	const actualOv = new OrientationVector()

	it('converts quaternion to orientation vector', () => {
		quaternion.set(0.707_106_781_186_547_6, 0, 0, 0.707_106_781_186_547_6)
		expectedOv.set(0, -1, 0, 1.570_796_326_794_896_6)
		expect(ovAppxEqual(expectedOv, actualOv.setFromQuaternion(quaternion))).toBe(true)

		quaternion.set(-0.707_106_781_186_547_6, 0, 0, 0.707_106_781_186_547_6)
		expectedOv.set(0, 1, 0, -1.570_796_326_794_896_6)
		expect(ovAppxEqual(expectedOv, actualOv.setFromQuaternion(quaternion))).toBe(true)

		quaternion.set(0, -0.28, 0, 0.96)
		expectedOv.set(-0.5376, 0, 0.8432, -1 * Math.PI)
		expect(ovAppxEqual(expectedOv, actualOv.setFromQuaternion(quaternion))).toBe(true)

		quaternion.set(0, 0, -0.28, 0.96)
		expectedOv.set(0, 0, 1, -0.567_588_218_416_655_7)
		expect(ovAppxEqual(expectedOv, actualOv.setFromQuaternion(quaternion))).toBe(true)

		quaternion.set(-0.28, 0, 0, 0.96)
		expectedOv.set(0, 0.5376, 0.8432, -1.570_796_326_794_896_6)
		expect(ovAppxEqual(expectedOv, actualOv.setFromQuaternion(quaternion))).toBe(true)

		quaternion.set(0.28, 0, 0, 0.96)
		expectedOv.set(0, -0.5376, 0.8432, 1.570_796_326_794_896_6)
		expect(ovAppxEqual(expectedOv, actualOv.setFromQuaternion(quaternion))).toBe(true)

		quaternion.set(-0.5, -0.5, -0.5, 0.5)
		expectedOv.set(0, 1, 0, -1 * Math.PI)
		expect(ovAppxEqual(expectedOv, actualOv.setFromQuaternion(quaternion))).toBe(true)

		quaternion.set(
			-0.175_559_660_254_131_42,
			0.391_983_971_939_798_17,
			0.385_537_548_516_400_1,
			0.816_632_212_270_443
		)
		expectedOv.set(0.504_843_794_294_005_4, 0.588_984_426_676_339_7, 0.631_054_742_867_507, 0.02)
		expect(ovAppxEqual(expectedOv, actualOv.setFromQuaternion(quaternion))).toBe(true)
	})

	it('roundtrips orientation vector to quaternion to orientation vector', () => {
		ov.set(0, 0.706635215799611, -0.7075780322987966, -Math.PI / 8)
		const quaternion = ov.toQuaternion(new Quaternion())
		actualOv.setFromQuaternion(quaternion)

		expect(numAppxEqual(ov.x, actualOv.x)).toBe(true)
		expect(numAppxEqual(ov.y, actualOv.y)).toBe(true)
		expect(numAppxEqual(ov.z, actualOv.z)).toBe(true)
		expect(numAppxEqual(ov.th, actualOv.th)).toBe(true)
	})

	describe('setUnits interaction with setFromQuaternion', () => {
		it('CORRECT: setFromQuaternion THEN setUnits("degrees") returns theta in degrees', () => {
			// Create a quaternion representing a 45° rotation around Z axis
			const quat = new Quaternion().setFromAxisAngle(new Vector3(0, 0, 1), Math.PI / 4)

			// CORRECT ORDER: setFromQuaternion first, then setUnits
			const ov = new OrientationVector().setFromQuaternion(quat).setUnits('degrees')

			// theta should be approximately 45 degrees (π/4 radians = 45°)
			// The OV points along Z, so theta represents rotation around Z
			expect(Math.abs(ov.th)).toBeGreaterThan(1) // Should be in degrees (tens), not radians (<1)
		})

		it('WRONG: setUnits("degrees") THEN setFromQuaternion corrupts theta', () => {
			// Create a quaternion representing a 45° rotation around Z axis
			const quat = new Quaternion().setFromAxisAngle(new Vector3(0, 0, 1), Math.PI / 4)

			// WRONG ORDER: setUnits first corrupts the value
			const ovWrong = new OrientationVector().setUnits('degrees').setFromQuaternion(quat)
			const ovCorrect = new OrientationVector().setFromQuaternion(quat).setUnits('degrees')

			// The wrong order produces a much smaller theta value
			// because setFromQuaternion passes radians to set(), which interprets them as degrees
			expect(Math.abs(ovWrong.th)).toBeLessThan(Math.abs(ovCorrect.th))
		})

		it('demonstrates the 57x difference in theta values', () => {
			// A more dramatic example: 90° rotation
			const quat = new Quaternion().setFromAxisAngle(new Vector3(0, 0, 1), Math.PI / 2)

			const ovCorrect = new OrientationVector().setFromQuaternion(quat).setUnits('degrees')
			const ovWrong = new OrientationVector().setUnits('degrees').setFromQuaternion(quat)

			// Correct should return ~90 degrees
			// Wrong should return ~90 * (π/180)² ≈ 0.027 degrees (double conversion error)
			const ratio = Math.abs(ovCorrect.th) / Math.abs(ovWrong.th)

			// The ratio should be approximately (180/π)² ≈ 3283 for the double conversion
			// or 180/π ≈ 57.3 for single conversion, depending on internal implementation
			expect(ratio).toBeGreaterThan(50) // At least 50x difference shows the bug
		})
	})
})
