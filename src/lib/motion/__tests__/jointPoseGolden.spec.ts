import { Quaternion } from 'three'
import { describe, expect, it } from 'vitest'

import type { JointFrameDescriptor } from '../frameDescriptors'

import goldenFile from '../../../../tools/rdk-golden/motion/testdata/joint_transform_golden.json'
import { computeJointPose } from '../jointPose'

interface GoldenJointCase {
	name: string
	axis: { X: number; Y: number; Z: number }
	value: number
	pose: {
		point: { x: number; y: number; z: number }
		quaternion: { w: number; x: number; y: number; z: number }
	}
}

const rotationalCases = goldenFile.rotational as GoldenJointCase[]
const translationalCases = goldenFile.translational as GoldenJointCase[]

/**
 * Matches the math goldens' 1e-8. Tighter than RDK's own `PoseAlmostEqual`, whose orientation
 * epsilon is 1e-4, because both sides here compute the same closed form.
 */
const PLACES = 8

const jointOf = (
	motion: JointFrameDescriptor['motion'],
	axis: GoldenJointCase['axis']
): JointFrameDescriptor => ({
	kind: 'joint',
	motion,
	name: 'arm:joint',
	parent: 'arm:base',
	axis,
	componentName: 'arm',
	jointIndex: 0,
	uuid: new Uint8Array(16) as Uint8Array<ArrayBuffer>,
})

/**
 * `q` and `-q` are the same rotation, so `q` is flipped onto `reference`'s hemisphere before the
 * components are compared. Components rather than `angleTo`, whose `acos` cannot resolve an angle
 * under about 3e-8 rad.
 */
const alignedTo = (q: Quaternion, reference: Quaternion): Quaternion =>
	q.dot(reference) < 0 ? new Quaternion(-q.x, -q.y, -q.z, -q.w) : q

const expectRdkPose = (motion: JointFrameDescriptor['motion'], goldenCase: GoldenJointCase) => {
	const { axis, value, pose } = goldenCase
	const out = computeJointPose(jointOf(motion, axis), value)

	expect(out.x).toBeCloseTo(pose.point.x, PLACES)
	expect(out.y).toBeCloseTo(pose.point.y, PLACES)
	expect(out.z).toBeCloseTo(pose.point.z, PLACES)

	const { w, x, y, z } = pose.quaternion
	const expected = new Quaternion(x, y, z, w)
	const actual = alignedTo(out.toQuaternion(), expected)
	expect(actual.x).toBeCloseTo(expected.x, PLACES)
	expect(actual.y).toBeCloseTo(expected.y, PLACES)
	expect(actual.z).toBeCloseTo(expected.z, PLACES)
	expect(actual.w).toBeCloseTo(expected.w, PLACES)
}

describe('computeJointPose for a revolute joint, against rotationalFrame.Transform', () => {
	it('reads all 7 rotational cases the Go generator wrote', () => {
		expect(rotationalCases.length).toBe(7)
	})

	it.each(rotationalCases)('builds RDKs pose $name', (goldenCase) => {
		expectRdkPose('rotational', goldenCase)
	})
})

describe('computeJointPose for a prismatic joint, against translationalFrame.Transform', () => {
	it('reads all 5 translational cases the Go generator wrote', () => {
		expect(translationalCases.length).toBe(5)
	})

	it.each(translationalCases)('builds RDKs pose $name', (goldenCase) => {
		expectRdkPose('translational', goldenCase)
	})
})
