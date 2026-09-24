import { Quaternion, Vector3 } from 'three'
import { describe, expect, it } from 'vitest'

import { EPSILON, OrientationVector } from '../OrientationVector'

const vecA = new Vector3()
const vecB = new Vector3()

const quatAppxEqual = (q1: Quaternion, q2: Quaternion) => {
	return q1.angleTo(q2) < EPSILON
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

	/**
	 * What a `common.v1.Pose` carrying only a position decodes to, since protobuf
	 * materialises absent scalars as `0`. RDK's `Normalize` reads it as unset and
	 * assigns `OZ = 1` before every conversion.
	 */
	describe('zero-length vector', () => {
		it.each([
			['set', () => new OrientationVector().set(0, 0, 0, 0)],
			['the constructor', () => new OrientationVector(0, 0, 0, 0)],
			['copy', () => new OrientationVector().copy({ x: 0, y: 0, z: 0, th: 0 })],
			['normalize', () => new OrientationVector().set(0, 0, 0, 0).normalize()],
		])('substitutes +Z via %s', (_label, build) => {
			const substituted = build()

			expect(substituted.x).toBe(0)
			expect(substituted.y).toBe(0)
			expect(substituted.z).toBe(1)
		})

		it('converts to identity rather than a quarter turn about +Y', () => {
			const identity = new OrientationVector().set(0, 0, 0, 0).toQuaternion(new Quaternion())

			expect(quatAppxEqual(new Quaternion(0, 0, 0, 1), identity)).toBe(true)
		})

		/** The vector is unset, not the angle: theta still turns about the substituted axis. */
		it('keeps theta as a rotation about +Z', () => {
			const quarterTurn = new OrientationVector()
				.set(0, 0, 0, Math.PI / 2)
				.toQuaternion(new Quaternion())

			expect(
				quatAppxEqual(
					new Quaternion().setFromAxisAngle(new Vector3(0, 0, 1), Math.PI / 2),
					quarterTurn
				)
			).toBe(true)
		})
	})
})
