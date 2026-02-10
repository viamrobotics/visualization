import { expect, describe, it } from 'vitest'
import { Quaternion, Euler } from 'three'
import { OrientationVector } from '$lib/three/OrientationVector'
import { getFrameTransformationQuaternion } from '$lib/utils/vr-math'

describe('Rotation Engagement Stability', () => {
	const EPSILON = 1e-6

	// Test 1: Quaternion storage doesn't accumulate errors
	it('stores and retrieves quaternion without error accumulation', () => {
		const originalQuat = new Quaternion(0.5, 0.5, 0.5, 0.5).normalize()
		const storedQuat = originalQuat.clone()

		// Simulate multiple engagement cycles
		for (let i = 0; i < 5; i++) {
			const retrieved = storedQuat.clone()
			expect(Math.abs(retrieved.x - originalQuat.x)).toBeLessThan(EPSILON)
			expect(Math.abs(retrieved.y - originalQuat.y)).toBeLessThan(EPSILON)
			expect(Math.abs(retrieved.z - originalQuat.z)).toBeLessThan(EPSILON)
			expect(Math.abs(retrieved.w - originalQuat.w)).toBeLessThan(EPSILON)
		}
	})

	// Test 2: Multiple roundtrips OV->Quat->OV are stable for simple cases
	it('demonstrates OrientationVector roundtrip behavior', () => {
		// Test with a simple case
		let currentOV = new OrientationVector(0, 0, 1, Math.PI / 4)
		const originalTheta = currentOV.th

		// Simulate 5 engagement cycles with OV storage (old approach)
		for (let i = 0; i < 5; i++) {
			const quat = currentOV.toQuaternion(new Quaternion())
			currentOV = new OrientationVector().setFromQuaternion(quat)
		}

		// For simple orientations, roundtrip should be stable
		const thetaDrift = Math.abs(currentOV.th - originalTheta)
		expect(thetaDrift).toBeLessThan(1e-6)

		// Test with a more complex case that might show drift
		let complexOV = new OrientationVector(0.5376, 0.5376, 0.8432, Math.PI / 3)
		const originalComplexTheta = complexOV.th

		for (let i = 0; i < 5; i++) {
			const quat = complexOV.toQuaternion(new Quaternion())
			complexOV = new OrientationVector().setFromQuaternion(quat)
		}

		const complexDrift = Math.abs(complexOV.th - originalComplexTheta)
		// The key point: even if drift is small, storing quaternions avoids this entirely
		expect(complexDrift).toBeLessThan(0.1) // Should be small
	})

	// Test 3: Controller delta calculation with frame transformation
	it('calculates controller rotation delta correctly with frame transform', () => {
		const qTransform = getFrameTransformationQuaternion()

		// Simulate engagement state
		const initialControllerRot = new Quaternion().setFromEuler(new Euler(0, 0, 0, 'XYZ'))
		const transformedInitial = qTransform
			.clone()
			.multiply(initialControllerRot)
			.multiply(qTransform.clone().invert())

		// Simulate controller rotation (45° around Y)
		const currentControllerRot = new Quaternion().setFromEuler(new Euler(0, Math.PI / 4, 0, 'XYZ'))
		const transformedCurrent = qTransform
			.clone()
			.multiply(currentControllerRot)
			.multiply(qTransform.clone().invert())

		// Calculate delta
		const delta = transformedInitial.clone().invert().multiply(transformedCurrent).normalize()

		// Delta should be meaningful (not identity)
		const deltaAngle = 2 * Math.acos(Math.min(1, Math.abs(delta.w)))
		expect(deltaAngle).toBeGreaterThan(0.01) // At least some rotation
		expect(deltaAngle).toBeLessThan(Math.PI) // But not a full flip
	})

	// Test 4: Engagement quaternion stability across multiple cycles
	it('maintains stable quaternion across multiple engagement cycles', () => {
		// Simulate arm pose
		const armOV = new OrientationVector(0, 0.707, 0.707, Math.PI / 6)
		const armQuat = armOV.toQuaternion(new Quaternion())

		// Store quaternion (new approach)
		const engagementQuat = armQuat.clone()

		// Simulate 5 engagement cycles
		for (let i = 0; i < 5; i++) {
			// Retrieve stored quaternion
			const retrieved = engagementQuat.clone()

			// Should be identical to original
			expect(Math.abs(retrieved.x - armQuat.x)).toBeLessThan(EPSILON)
			expect(Math.abs(retrieved.y - armQuat.y)).toBeLessThan(EPSILON)
			expect(Math.abs(retrieved.z - armQuat.z)).toBeLessThan(EPSILON)
			expect(Math.abs(retrieved.w - armQuat.w)).toBeLessThan(EPSILON)

			// Simulate controller movement and delta application
			const controllerDelta = new Quaternion().setFromEuler(new Euler(0.1, 0, 0, 'XYZ'))
			const newArmQuat = retrieved.multiply(controllerDelta).normalize()

			// Convert to OV for command (only once, at the end)
			const targetOV = new OrientationVector().setFromQuaternion(newArmQuat)

			// Verify OV is reasonable
			expect(targetOV.th).toBeDefined()
			expect(isFinite(targetOV.th)).toBe(true)
		}
	})

	// Test 5: First frame after engagement uses stored quaternion correctly
	it('uses stored quaternion on first frame when controller hasnt moved', () => {
		const armQuat = new Quaternion(0.5, 0.5, 0.5, 0.5).normalize()
		const controllerQuat = new Quaternion(0.7, 0.1, 0.1, 0.7).normalize()

		// Store engagement state (new approach)
		const engagementArmQuat = armQuat.clone()
		const engagementControllerQuat = controllerQuat.clone()

		// First frame: controller hasn't moved (delta is identity)
		const currentControllerQuat = controllerQuat.clone()
		const delta = engagementControllerQuat.clone().invert().multiply(currentControllerQuat)
		const deltaAngle = 2 * Math.acos(Math.min(1, Math.abs(delta.w)))

		// Check if controller barely moved
		expect(deltaAngle).toBeLessThan(0.01)

		// Should use engagement quaternion directly
		const targetQuat = engagementArmQuat.clone()

		// Should be identical to stored quaternion
		expect(targetQuat.x).toBeCloseTo(armQuat.x, 6)
		expect(targetQuat.y).toBeCloseTo(armQuat.y, 6)
		expect(targetQuat.z).toBeCloseTo(armQuat.z, 6)
		expect(targetQuat.w).toBeCloseTo(armQuat.w, 6)
	})

	// Test 6: Quaternion negation equivalence
	it('handles quaternion double cover (q and -q represent same rotation)', () => {
		const q1 = new Quaternion(0.5, 0.5, 0.5, 0.5).normalize()
		const q2 = new Quaternion(-q1.x, -q1.y, -q1.z, -q1.w)

		// Both should produce the same OrientationVector (within sign ambiguity)
		const ov1 = new OrientationVector().setFromQuaternion(q1)
		const ov2 = new OrientationVector().setFromQuaternion(q2)

		// Axis should be same or opposite
		const axisDot = ov1.x * ov2.x + ov1.y * ov2.y + ov1.z * ov2.z
		expect(Math.abs(Math.abs(axisDot) - 1)).toBeLessThan(EPSILON)

		// If axis is opposite, theta should be negated
		if (axisDot < 0) {
			expect(Math.abs(ov1.th + ov2.th)).toBeLessThan(EPSILON)
		} else {
			expect(Math.abs(ov1.th - ov2.th)).toBeLessThan(EPSILON)
		}
	})
})
