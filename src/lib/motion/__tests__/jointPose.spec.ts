import { Quaternion, Vector3 } from 'three'
import { describe, expect, it } from 'vitest'

import { Pose } from '$lib/math'

import type { FrameDescriptor, JointFrameDescriptor } from '../frameDescriptors'

import { computeJointPose, descriptorLocalPose, jointValueAt } from '../jointPose'

const uuid = () => new Uint8Array(16) as Uint8Array<ArrayBuffer>

const joint = (
	overrides: Partial<JointFrameDescriptor> & Pick<JointFrameDescriptor, 'motion'>
): JointFrameDescriptor => ({
	kind: 'joint',
	name: 'arm:j1',
	parent: 'arm:base',
	axis: { X: 0, Y: 0, Z: 1 },
	componentName: 'arm',
	jointIndex: 0,
	uuid: uuid(),
	...overrides,
})

const staticFrame = (localPose: Pose): FrameDescriptor => ({
	kind: 'static',
	name: 'base',
	parent: 'world',
	localPose,
	geometry: null,
	uuid: uuid(),
})

describe('computeJointPose', () => {
	it('rotates about the declared axis by the step value in radians', () => {
		const pose = computeJointPose(joint({ motion: 'rotational' }), Math.PI / 2)

		expect(
			pose
				.toQuaternion()
				.angleTo(new Quaternion().setFromAxisAngle(new Vector3(0, 0, 1), Math.PI / 2))
		).toBeCloseTo(0)
		expect(pose.theta).toBeCloseTo(90)
		expect(pose.oZ).toBeCloseTo(1)
		// A revolute joint contributes no translation: RDK's `NewPoseFromOrientation` leaves the dual
		// part zero.
		expect([pose.x, pose.y, pose.z]).toEqual([0, 0, 0])
	})

	it('slides along the declared axis by the step value in millimetres', () => {
		const pose = computeJointPose(joint({ motion: 'translational' }), 250)
		expect([pose.x, pose.y, pose.z]).toEqual([0, 0, 250])
	})

	it.each([
		[{ X: 0, Y: 0, Z: 2 }, 250],
		[{ X: 0, Y: 0, Z: 0.5 }, 250],
	] as const)('normalizes a non-unit translational axis %j', (axis, value) => {
		const pose = computeJointPose(joint({ motion: 'translational', axis }), value)
		expect([pose.x, pose.y, pose.z]).toEqual([0, 0, value])
	})

	it('normalizes a non-unit rotational axis', () => {
		const scaled = computeJointPose(joint({ motion: 'rotational', axis: { X: 0, Y: 0, Z: 3 } }), 1)
		const unit = computeJointPose(joint({ motion: 'rotational' }), 1)

		expect(scaled.toQuaternion().angleTo(unit.toQuaternion())).toBeCloseTo(0)
	})

	it.each([
		['an absent axis', undefined],
		['a non-numeric axis', { X: Number.NaN, Y: 0, Z: 1 }],
		['a zero-length axis', { X: 0, Y: 0, Z: 0 }],
	] as const)('throws a named error for %s', (_label, axis) => {
		expect(() => computeJointPose(joint({ motion: 'rotational', axis }), 1)).toThrow(/axis/)
	})
})

describe('jointValueAt', () => {
	const step = { arm: [0.1, 0.2] }

	it("reads the component's column at the joint's index", () => {
		expect(jointValueAt(joint({ motion: 'rotational', jointIndex: 1 }), step)).toBeCloseTo(0.2)
	})

	it.each([
		['an absent component', {}],
		['a shorter column', { arm: [] }],
	])('falls back to zero for %s', (_label, inputs) => {
		expect(jointValueAt(joint({ motion: 'rotational' }), inputs)).toBe(0)
	})

	it('applies a mimic as multiplier times source plus offset', () => {
		const mimic = joint({ motion: 'rotational', mimic: { multiplier: -1, offset: 0.5 } })
		expect(jointValueAt(mimic, step)).toBeCloseTo(-0.1 + 0.5)
	})

	it('is not the same as offset times multiplier plus source', () => {
		const mimic = joint({ motion: 'rotational', mimic: { multiplier: 2, offset: 1 } })
		// 2 * 0.1 + 1 = 1.2, where the transposed reading gives 1 * 0.1 + 2 = 2.1.
		expect(jointValueAt(mimic, step)).toBeCloseTo(1.2)
	})
})

describe('descriptorLocalPose', () => {
	it("returns a static frame's configured pose", () => {
		const pose = descriptorLocalPose(staticFrame(new Pose(1, 2, 3)), {})

		expect([pose.x, pose.y, pose.z]).toEqual([1, 2, 3])
	})

	it('copies a static pose, so writing to the result cannot move the frame', () => {
		const descriptor = staticFrame(new Pose(1, 2, 3))

		descriptorLocalPose(descriptor, {}).x = 99

		expect(descriptorLocalPose(descriptor, {}).x).toBe(1)
	})

	it('drives a joint frame from the step', () => {
		const pose = descriptorLocalPose(joint({ motion: 'translational' }), { arm: [40] })
		expect([pose.x, pose.y, pose.z]).toEqual([0, 0, 40])
	})

	it('resolves a mimic joint the same way for either consumer', () => {
		const mimic = joint({
			motion: 'rotational',
			mimic: { multiplier: -1, offset: 0.25 },
		})

		const pose = descriptorLocalPose(mimic, { arm: [0.5] })

		expect(pose.theta).toBeCloseTo(-14.3239)
		expect(pose.oZ).toBeCloseTo(1)
		expect([pose.x, pose.y, pose.z]).toEqual([0, 0, 0])
	})
})
