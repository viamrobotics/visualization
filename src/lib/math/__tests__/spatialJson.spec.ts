import { MathUtils, Quaternion, Vector3 } from 'three'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { RawOrientation } from '../spatialJson'

import { geometryCenterInFrame, poseFromJson } from '../spatialJson'

/** Compare orientations by the rotation they produce, not by field values. */
const rotates = (pose: ReturnType<typeof poseFromJson>, from: Vector3) =>
	from.clone().applyQuaternion(pose.toQuaternion())

const expectVectorClose = (actual: Vector3, expected: [number, number, number]) => {
	expect(actual.x).toBeCloseTo(expected[0], 5)
	expect(actual.y).toBeCloseTo(expected[1], 5)
	expect(actual.z).toBeCloseTo(expected[2], 5)
}

describe('poseFromJson', () => {
	const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
	afterEach(() => warn.mockClear())

	it('reads capitalised translation fields as millimetres', () => {
		const pose = poseFromJson({ X: 10, Y: -20, Z: 30 }, undefined)

		expect(pose.x).toBe(10)
		expect(pose.y).toBe(-20)
		expect(pose.z).toBe(30)
	})

	it('defaults a missing pose to the origin', () => {
		const pose = poseFromJson(undefined, undefined)

		expect(pose.x).toBe(0)
		expect(pose.y).toBe(0)
		expect(pose.z).toBe(0)
		expect(pose.oZ).toBe(1)
	})

	/**
	 * RDK's `NoOrientationType` is the empty string and parses to
	 * `NewZeroOrientation`, so an absent or empty `type` is identity — not an
	 * implied `ov_degrees`. A value with no type is the same case: there is
	 * nothing to say which encoding it is in, and `axis_angles` and both
	 * orientation-vector types share `{ x, y, z, th }`, so guessing would decode
	 * to a plausible rotation rather than fail.
	 */
	it.each([
		['absent', undefined],
		['empty-string type', { type: '', value: {} }],
		['a value with no type', { value: { x: 0, y: -1, z: 0, th: 90 } }],
	] satisfies [string, RawOrientation | undefined][])(
		'reads %s as the identity orientation, silently',
		(_label, orientation) => {
			const pose = poseFromJson(undefined, orientation)

			// toBeCloseTo throughout: an identity quaternion round-trips through
			// OrientationVector with signed zeros, and -0 is not the assertion.
			expect(pose.oX).toBeCloseTo(0)
			expect(pose.oY).toBeCloseTo(0)
			expect(pose.oZ).toBeCloseTo(1)
			expect(pose.theta).toBeCloseTo(0)
			expect(warn).not.toHaveBeenCalled()
		}
	)

	/** `rotation_matrix` is real in spatialmath but never marshalled by `NewOrientationConfig`. */
	it('warns and falls back to identity for an encoding it cannot convert', () => {
		const pose = poseFromJson(
			{ X: 1, Y: 0, Z: 0 },
			{ type: 'rotation_matrix', value: { rows: [] } }
		)

		expect(warn).toHaveBeenCalledWith(
			expect.stringContaining('unhandled orientation "rotation_matrix"')
		)
		// The translation still lands — one bad field shouldn't lose the frame.
		expect(pose.x).toBe(1)
		expect(pose.theta).toBeCloseTo(0)
	})

	/**
	 * Every case is the same rotation — 90° about +X — spelled five ways, so the
	 * assertion can be shared: +Y maps to +Z.
	 */
	const quarterTurnAboutX: [string, RawOrientation][] = [
		['ov_degrees', { type: 'ov_degrees', value: { x: 0, y: -1, z: 0, th: 90 } }],
		[
			'ov_radians',
			{ type: 'ov_radians', value: { x: 0, y: -1, z: 0, th: MathUtils.degToRad(90) } },
		],
		['quaternion', { type: 'quaternion', value: { X: Math.SQRT1_2, Y: 0, Z: 0, W: Math.SQRT1_2 } }],
		['euler_angles', { type: 'euler_angles', value: { roll: Math.PI / 2, pitch: 0, yaw: 0 } }],
		['axis_angles', { type: 'axis_angles', value: { x: 1, y: 0, z: 0, th: Math.PI / 2 } }],
	]

	it.each(quarterTurnAboutX)('reads a 90° turn about +X from %s', (_label, orientation) => {
		const pose = poseFromJson(undefined, orientation)

		expectVectorClose(rotates(pose, new Vector3(0, 1, 0)), [0, 0, 1])
		expect(warn).not.toHaveBeenCalled()
	})

	it('agrees with three.js on a quaternion round trip', () => {
		const source = new Quaternion().setFromAxisAngle(new Vector3(1, 2, 3).normalize(), 0.7)
		const pose = poseFromJson(undefined, {
			type: 'quaternion',
			value: { X: source.x, Y: source.y, Z: source.z, W: source.w },
		})

		const point = new Vector3(4, 5, 6)
		const expected = point.clone().applyQuaternion(source)

		expectVectorClose(rotates(pose, point), [expected.x, expected.y, expected.z])
	})

	/** R4AA arrives un-normalized; `setFromAxisAngle` assumes a unit axis. */
	it('normalizes an axis_angles axis', () => {
		const pose = poseFromJson(undefined, {
			type: 'axis_angles',
			value: { x: 0, y: 0, z: 5, th: Math.PI / 2 },
		})

		expectVectorClose(rotates(pose, new Vector3(1, 0, 0)), [0, 1, 0])
	})
})

describe('geometryCenterInFrame', () => {
	it('subtracts the frame translation', () => {
		const center = geometryCenterInFrame({ X: 15, Y: 2, Z: 0 }, undefined, {
			translation: { X: 10, Y: 0, Z: 0 },
		})

		expect(center.x).toBeCloseTo(5)
		expect(center.y).toBeCloseTo(2)
		expect(center.z).toBeCloseTo(0)
	})

	it('undoes the frame rotation', () => {
		// A frame turned 90° about +X maps +Y to +Z, so undoing it sends the
		// geometry's +Y offset to -Z.
		const center = geometryCenterInFrame({ X: 0, Y: 10, Z: 0 }, undefined, {
			orientation: { type: 'ov_degrees', value: { x: 0, y: -1, z: 0, th: 90 } },
		})

		expect(center.x).toBeCloseTo(0)
		expect(center.y).toBeCloseTo(0)
		expect(center.z).toBeCloseTo(-10)
	})

	it('leaves an unrotated frame at the origin alone', () => {
		const center = geometryCenterInFrame({ X: 1, Y: 2, Z: 3 }, undefined, {})

		expect(center.x).toBeCloseTo(1)
		expect(center.y).toBeCloseTo(2)
		expect(center.z).toBeCloseTo(3)
		expect(center.theta).toBeCloseTo(0)
	})

	it('composes the geometry orientation against the frame', () => {
		// The same rotation on both, so the frame divides the geometry's out entirely.
		const quarterTurn: RawOrientation = {
			type: 'ov_degrees',
			value: { x: 0, y: -1, z: 0, th: 90 },
		}
		const center = geometryCenterInFrame(undefined, quarterTurn, { orientation: quarterTurn })

		expect(center.theta).toBeCloseTo(0)
	})
})
