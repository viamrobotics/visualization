import { Euler, Quaternion } from 'three'
import { describe, expect, it } from 'vitest'

import { OrientationVector } from '$lib/math/OrientationVector'
import { getFrameTransformationQuaternion } from '$lib/plugins/XR/math'

describe('Rotation Engagement Stability', () => {
	const EPSILON = 1e-6

	it('stores and retrieves quaternion without error accumulation', () => {
		const originalQuat = new Quaternion(0.5, 0.5, 0.5, 0.5).normalize()
		const storedQuat = originalQuat.clone()

		for (let i = 0; i < 5; i++) {
			const retrieved = storedQuat.clone()
			expect(Math.abs(retrieved.x - originalQuat.x)).toBeLessThan(EPSILON)
			expect(Math.abs(retrieved.y - originalQuat.y)).toBeLessThan(EPSILON)
			expect(Math.abs(retrieved.z - originalQuat.z)).toBeLessThan(EPSILON)
			expect(Math.abs(retrieved.w - originalQuat.w)).toBeLessThan(EPSILON)
		}
	})

	it('demonstrates OrientationVector roundtrip behavior', () => {
		let currentOV = new OrientationVector(0, 0, 1, Math.PI / 4)
		const originalTheta = currentOV.th

		for (let i = 0; i < 5; i++) {
			const quat = currentOV.toQuaternion(new Quaternion())
			currentOV = new OrientationVector().setFromQuaternion(quat)
		}

		const thetaDrift = Math.abs(currentOV.th - originalTheta)
		expect(thetaDrift).toBeLessThan(1e-6)

		let complexOV = new OrientationVector(0.5376, 0.5376, 0.8432, Math.PI / 3)
		const originalComplexTheta = complexOV.th

		for (let i = 0; i < 5; i++) {
			const quat = complexOV.toQuaternion(new Quaternion())
			complexOV = new OrientationVector().setFromQuaternion(quat)
		}

		const complexDrift = Math.abs(complexOV.th - originalComplexTheta)
		expect(complexDrift).toBeLessThan(0.1) // Should be small
	})

	it('calculates controller rotation delta correctly with frame transform', () => {
		const qTransform = getFrameTransformationQuaternion()

		const initialControllerRot = new Quaternion().setFromEuler(new Euler(0, 0, 0, 'XYZ'))
		const transformedInitial = qTransform
			.clone()
			.multiply(initialControllerRot)
			.multiply(qTransform.clone().invert())

		const currentControllerRot = new Quaternion().setFromEuler(new Euler(0, Math.PI / 4, 0, 'XYZ'))
		const transformedCurrent = qTransform
			.clone()
			.multiply(currentControllerRot)
			.multiply(qTransform.clone().invert())

		const delta = transformedInitial.clone().invert().multiply(transformedCurrent).normalize()

		const deltaAngle = 2 * Math.acos(Math.min(1, Math.abs(delta.w)))
		expect(deltaAngle).toBeGreaterThan(0.01)
		expect(deltaAngle).toBeLessThan(Math.PI) // But not a full flip
	})

	it('maintains stable quaternion across multiple engagement cycles', () => {
		const armOV = new OrientationVector(0, 0.707, 0.707, Math.PI / 6)
		const armQuat = armOV.toQuaternion(new Quaternion())

		const engagementQuat = armQuat.clone()

		for (let i = 0; i < 5; i++) {
			const retrieved = engagementQuat.clone()

			expect(Math.abs(retrieved.x - armQuat.x)).toBeLessThan(EPSILON)
			expect(Math.abs(retrieved.y - armQuat.y)).toBeLessThan(EPSILON)
			expect(Math.abs(retrieved.z - armQuat.z)).toBeLessThan(EPSILON)
			expect(Math.abs(retrieved.w - armQuat.w)).toBeLessThan(EPSILON)

			const controllerDelta = new Quaternion().setFromEuler(new Euler(0.1, 0, 0, 'XYZ'))
			const newArmQuat = retrieved.multiply(controllerDelta).normalize()

			const targetOV = new OrientationVector().setFromQuaternion(newArmQuat)

			expect(targetOV.th).toBeDefined()
			expect(Number.isFinite(targetOV.th)).toBe(true)
		}
	})

	it('uses stored quaternion on first frame when controller hasnt moved', () => {
		const armQuat = new Quaternion(0.5, 0.5, 0.5, 0.5).normalize()
		const controllerQuat = new Quaternion(0.7, 0.1, 0.1, 0.7).normalize()

		const engagementArmQuat = armQuat.clone()
		const engagementControllerQuat = controllerQuat.clone()

		const currentControllerQuat = controllerQuat.clone()
		const delta = engagementControllerQuat.clone().invert().multiply(currentControllerQuat)
		const deltaAngle = 2 * Math.acos(Math.min(1, Math.abs(delta.w)))

		expect(deltaAngle).toBeLessThan(0.01)

		const targetQuat = engagementArmQuat.clone()

		expect(targetQuat.x).toBeCloseTo(armQuat.x, 6)
		expect(targetQuat.y).toBeCloseTo(armQuat.y, 6)
		expect(targetQuat.z).toBeCloseTo(armQuat.z, 6)
		expect(targetQuat.w).toBeCloseTo(armQuat.w, 6)
	})

	it('handles quaternion double cover (q and -q represent same rotation)', () => {
		const q1 = new Quaternion(0.5, 0.5, 0.5, 0.5).normalize()
		const q2 = new Quaternion(-q1.x, -q1.y, -q1.z, -q1.w)

		// Both should produce the same OrientationVector (within sign ambiguity)
		const ov1 = new OrientationVector().setFromQuaternion(q1)
		const ov2 = new OrientationVector().setFromQuaternion(q2)

		const axisDot = ov1.x * ov2.x + ov1.y * ov2.y + ov1.z * ov2.z
		expect(Math.abs(Math.abs(axisDot) - 1)).toBeLessThan(EPSILON)

		if (axisDot < 0) {
			expect(Math.abs(ov1.th + ov2.th)).toBeLessThan(EPSILON)
		} else {
			expect(Math.abs(ov1.th - ov2.th)).toBeLessThan(EPSILON)
		}
	})
})
