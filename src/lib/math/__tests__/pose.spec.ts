import { MathUtils, Matrix4, Object3D, Quaternion, Vector3 } from 'three'
import { describe, expect, it } from 'vitest'

import type { Frame } from '$lib/frame'

import { Pose, type PosePatch } from '../pose'

/**
 * `OrientationVector.spec.ts` owns the quaternion↔orientation-vector trig. What
 * `Pose` adds is three thin adapters — millimetres↔metres, degrees↔radians and
 * field defaulting — so that is what these tests exercise.
 *
 * Round-trips cancel unit errors out: `setFromVector3(toVector3(p))` passes
 * whether the constants are 1000/0.001 or 1/1. Every unit boundary therefore
 * gets at least one *absolute* assertion alongside its round-trip.
 */

const fields = (pose: Pose) => ({
	x: pose.x,
	y: pose.y,
	z: pose.z,
	oX: pose.oX,
	oY: pose.oY,
	oZ: pose.oZ,
	theta: pose.theta,
})

const FIELDS = ['x', 'y', 'z', 'oX', 'oY', 'oZ', 'theta'] as const

/** A 90° rotation about +X. Verified against the RDK fixtures in `OrientationVector.spec.ts`. */
const quarterTurnAboutX = new Quaternion(Math.SQRT1_2, 0, 0, Math.SQRT1_2)

/**
 * Rz(yaw) · Ry(pitch) · Rx(roll), composed from axis-angles rather than three.js'
 * `Euler` order string so the assertions state ZYX independently of the code
 * under test.
 */
const composeZYX = (roll: number, pitch: number, yaw: number) =>
	new Quaternion()
		.setFromAxisAngle(new Vector3(0, 0, 1), yaw)
		.multiply(new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), pitch))
		.multiply(new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), roll))

/** All three angles are non-zero: a single-axis rotation cannot tell ZYX from XYZ. */
const tiltedRoll = 0.3
const tiltedPitch = 0.5
const tiltedYaw = 0.7

describe('the oZ defaulting rule', () => {
	// The rule is written out twice, in the constructor and in `copy`, so every
	// case runs through both.
	const cases = [
		{ name: 'no orientation fields at all', patch: {}, expected: { oX: 0, oY: 0, oZ: 1 } },
		{ name: 'only oX supplied', patch: { oX: 1 }, expected: { oX: 1, oY: 0, oZ: 0 } },
		{ name: 'only oY supplied', patch: { oY: 1 }, expected: { oX: 0, oY: 1, oZ: 0 } },
		{ name: 'only oZ supplied', patch: { oZ: 1 }, expected: { oX: 0, oY: 0, oZ: 1 } },
		{ name: 'oX supplied as zero', patch: { oX: 0 }, expected: { oX: 0, oY: 0, oZ: 0 } },
		{ name: 'oZ supplied as zero', patch: { oZ: 0 }, expected: { oX: 0, oY: 0, oZ: 0 } },
		{
			name: 'the whole vector supplied',
			patch: { oX: 0, oY: 1, oZ: 0 },
			expected: { oX: 0, oY: 1, oZ: 0 },
		},
	] satisfies { name: string; patch: PosePatch; expected: { oX: number; oY: number; oZ: number } }[]

	it.each(cases)('the constructor defaults oZ with $name', ({ patch, expected }) => {
		const pose = new Pose(1, 2, 3, patch.oX, patch.oY, patch.oZ, 45)

		expect(fields(pose)).toEqual({ x: 1, y: 2, z: 3, theta: 45, ...expected })
	})

	it.each(cases)('copy defaults oZ with $name', ({ patch, expected }) => {
		const pose = new Pose().copy({ x: 1, y: 2, z: 3, theta: 45, ...patch })

		expect(fields(pose)).toEqual({ x: 1, y: 2, z: 3, theta: 45, ...expected })
	})

	it.each(cases)('the constructor and copy agree with $name', ({ patch }) => {
		const constructed = new Pose(1, 2, 3, patch.oX, patch.oY, patch.oZ, 45)
		const copied = new Pose().copy({ x: 1, y: 2, z: 3, theta: 45, ...patch })

		expect(fields(copied)).toEqual(fields(constructed))
	})

	it('defaults an argumentless pose to the identity orientation', () => {
		expect(fields(new Pose())).toEqual({ x: 0, y: 0, z: 0, oX: 0, oY: 0, oZ: 1, theta: 0 })
	})

	it('agrees with copy on a wholly undefined pose', () => {
		expect(fields(new Pose().copy(undefined))).toEqual(fields(new Pose()))
	})
})

describe('copy vs merge', () => {
	const dirty = () => new Pose(11, 22, 33, 1, 0, 0, 44)

	it('resets the fields the patch omits rather than leaving them in place', () => {
		// Call sites copy optional wire fields into reused scratch poses; a no-op
		// here would silently carry the previous entity's pose forward.
		expect(fields(dirty().copy({ x: 5 }))).toEqual({
			x: 5,
			y: 0,
			z: 0,
			oX: 0,
			oY: 0,
			oZ: 1,
			theta: 0,
		})
	})

	it('resets to the identity pose when given nothing at all', () => {
		expect(fields(dirty().copy(undefined))).toEqual(fields(new Pose()))
	})

	it('merge leaves the fields the patch omits untouched', () => {
		expect(fields(dirty().merge({ x: 5 }))).toEqual({ ...fields(dirty()), x: 5 })
	})

	it('merge with an empty patch changes nothing', () => {
		expect(fields(dirty().merge({}))).toEqual(fields(dirty()))
	})

	it('merge writes explicit zeros', () => {
		// Guards the `!== undefined` checks against a truthiness regression.
		const pose = dirty().merge({ x: 0, y: 0, z: 0, oX: 0, oY: 0, oZ: 0, theta: 0 })

		expect(fields(pose)).toEqual({ x: 0, y: 0, z: 0, oX: 0, oY: 0, oZ: 0, theta: 0 })
	})
})

describe('unit conversion', () => {
	it('writes millimetres out as metres', () => {
		const vector = new Pose(1000, 2000, 3000).toVector3()

		expect(vector.x).toBeCloseTo(1, 10)
		expect(vector.y).toBeCloseTo(2, 10)
		expect(vector.z).toBeCloseTo(3, 10)
	})

	it('reads metres in as millimetres', () => {
		const pose = new Pose().setFromVector3(new Vector3(1, 2, 3))

		expect(pose.x).toBeCloseTo(1000, 6)
		expect(pose.y).toBeCloseTo(2000, 6)
		expect(pose.z).toBeCloseTo(3000, 6)
	})

	it('positions a matrix in metres', () => {
		const matrix = new Pose(1000, 2000, 3000).toMatrix4()
		const position = new Vector3().setFromMatrixPosition(matrix)

		expect(position.x).toBeCloseTo(1, 10)
		expect(position.y).toBeCloseTo(2, 10)
		expect(position.z).toBeCloseTo(3, 10)
	})

	it('reads a matrix position back as millimetres', () => {
		const matrix = new Matrix4().setPosition(1, 2, 3)
		const pose = new Pose().setFromMatrix4(matrix)

		expect(pose.x).toBeCloseTo(1000, 6)
		expect(pose.y).toBeCloseTo(2000, 6)
		expect(pose.z).toBeCloseTo(3000, 6)
	})

	it('discards the scale a decomposed matrix carries', () => {
		const matrix = new Matrix4().compose(
			new Vector3(1, 2, 3),
			quarterTurnAboutX,
			new Vector3(7, 7, 7)
		)
		const pose = new Pose().setFromMatrix4(matrix)

		expect(pose.x).toBeCloseTo(1000, 6)
		expect(pose.theta).toBeCloseTo(90, 6)
	})

	it('positions an Object3D in metres', () => {
		const object3D = new Pose(1000, 2000, 3000).toObject3D()

		expect(object3D.position.x).toBeCloseTo(1, 10)
		expect(object3D.position.y).toBeCloseTo(2, 10)
		expect(object3D.position.z).toBeCloseTo(3, 10)
	})

	it('reads an Object3D position back as millimetres', () => {
		const object3D = new Object3D()
		object3D.position.set(1, 2, 3)
		object3D.quaternion.copy(quarterTurnAboutX)

		const pose = new Pose().setFromObject3D(object3D)

		expect(pose.x).toBeCloseTo(1000, 6)
		expect(pose.theta).toBeCloseTo(90, 6)
	})

	it('round-trips a position through a matrix', () => {
		const pose = new Pose(100, -250, 40, 0, 1, 0, 35)
		const read = new Pose().setFromMatrix4(pose.toMatrix4())

		expect(fields(read)).toEqual({
			x: expect.closeTo(100, 6),
			y: expect.closeTo(-250, 6),
			z: expect.closeTo(40, 6),
			oX: expect.closeTo(0, 6),
			oY: expect.closeTo(1, 6),
			oZ: expect.closeTo(0, 6),
			theta: expect.closeTo(35, 6),
		})
	})

	it('stores theta in degrees, not radians', () => {
		// The assertion a round-trip cannot make: a dropped radToDeg would leave
		// theta at ~1.5708 and still survive every conversion back out.
		const pose = new Pose().setFromQuaternion(quarterTurnAboutX)

		expect(pose.theta).toBeCloseTo(90, 6)
		expect(fields(pose)).toMatchObject({
			oX: expect.closeTo(0, 6),
			oY: expect.closeTo(-1, 6),
			oZ: expect.closeTo(0, 6),
		})
	})

	it('reads theta in degrees back out', () => {
		const quaternion = new Pose(0, 0, 0, 0, -1, 0, 90).toQuaternion()

		expect(quaternion.x).toBeCloseTo(Math.SQRT1_2, 6)
		expect(quaternion.y).toBeCloseTo(0, 6)
		expect(quaternion.z).toBeCloseTo(0, 6)
		expect(quaternion.w).toBeCloseTo(Math.SQRT1_2, 6)
	})

	it('leaves theta unscaled through a matrix round-trip', () => {
		const pose = new Pose(0, 0, 0, 0, 0, 1, 35)

		expect(new Pose().setFromMatrix4(pose.toMatrix4()).theta).toBeCloseTo(35, 6)
	})

	it('reports euler angles in degrees using the ZYX convention', () => {
		// Recomposing the reported angles has to reproduce the pose's own rotation,
		// which pins the ordering and the degrees together.
		const pose = new Pose(0, 0, 0, 0, 1, 0, 35)
		const { roll, pitch, yaw } = pose.toEulerDegrees()

		const recomposed = composeZYX(
			MathUtils.degToRad(roll),
			MathUtils.degToRad(pitch),
			MathUtils.degToRad(yaw)
		)

		expect(recomposed.angleTo(pose.toQuaternion())).toBeCloseTo(0, 6)
	})
})

describe('shared scratch objects', () => {
	// `ov`, `quaternion`, `euler`, `translation` and `scale` are module singletons
	// shared by every instance, so the risk is a method handing one of them out.
	const pose = new Pose(100, -250, 40, 0, 1, 0, 35)

	it('returns a fresh Quaternion per call', () => {
		const first = pose.toQuaternion()
		const second = pose.toQuaternion()

		expect(first).not.toBe(second)

		second.set(0, 0, 0, 1)
		expect(first.equals(second)).toBe(false)
	})

	it('returns a fresh Matrix4 per call', () => {
		const first = pose.toMatrix4()
		const second = pose.toMatrix4()

		expect(first).not.toBe(second)

		second.identity()
		expect(first.equals(second)).toBe(false)
	})

	it('returns a fresh Vector3 per call', () => {
		const first = pose.toVector3()
		const second = pose.toVector3()

		expect(first).not.toBe(second)

		second.set(0, 0, 0)
		expect(first.equals(second)).toBe(false)
	})

	it('returns a fresh Object3D per call', () => {
		expect(pose.toObject3D()).not.toBe(pose.toObject3D())
	})

	it('leaves a caller-owned destination alone on the next conversion', () => {
		const destination = pose.toQuaternion(new Quaternion())
		const expected = destination.clone()

		pose.toEulerDegrees()
		new Pose(1, 2, 3).toQuaternion()

		expect(destination.equals(expected)).toBe(true)
	})

	it('does not clobber one pose’s matrix when another converts', () => {
		const first = pose.toMatrix4()
		const expected = first.clone()

		new Pose(999, 999, 999, 1, 0, 0, 12).toMatrix4()

		expect(first.equals(expected)).toBe(true)
	})

	it('clones independently of the original', () => {
		const original = new Pose(1, 2, 3, 0, 1, 0, 45)
		const clone = original.clone()

		expect(clone).not.toBe(original)
		expect(fields(clone)).toEqual(fields(original))

		clone.merge({ x: 99, theta: 0 })
		expect(original.x).toBe(1)
		expect(original.theta).toBe(45)
	})
})

describe('setFromFrame', () => {
	it('converts a quaternion orientation', () => {
		const pose = new Pose().setFromFrame({
			orientation: {
				type: 'quaternion',
				value: { x: Math.SQRT1_2, y: 0, z: 0, w: Math.SQRT1_2 },
			},
		})

		expect(fields(pose)).toEqual({
			x: 0,
			y: 0,
			z: 0,
			oX: expect.closeTo(0, 6),
			oY: expect.closeTo(-1, 6),
			oZ: expect.closeTo(0, 6),
			theta: expect.closeTo(90, 6),
		})
	})

	it('reads euler angles as radians', () => {
		// RDK's spatialmath.EulerAngles documents radians, and ParseConfig unmarshals
		// them with no conversion — unlike ov_degrees, which gets its own type.
		const pose = new Pose().setFromFrame({
			orientation: { type: 'euler_angles', value: { roll: 0, pitch: 0, yaw: Math.PI / 2 } },
		})

		expect(fields(pose)).toEqual({
			x: 0,
			y: 0,
			z: 0,
			oX: expect.closeTo(0, 6),
			oY: expect.closeTo(0, 6),
			oZ: expect.closeTo(1, 6),
			theta: expect.closeTo(90, 6),
		})
	})

	it('composes euler angles in ZYX order', () => {
		// RDK uses the z-y′-x″ sequence; `motion/frameDescriptors.ts` decodes to match.
		const pose = new Pose().setFromFrame({
			orientation: {
				type: 'euler_angles',
				value: { roll: tiltedRoll, pitch: tiltedPitch, yaw: tiltedYaw },
			},
		})

		const expected = composeZYX(tiltedRoll, tiltedPitch, tiltedYaw)

		expect(pose.toQuaternion().angleTo(expected)).toBeCloseTo(0, 6)
	})

	it('converts ov_radians into stored degrees', () => {
		const pose = new Pose().setFromFrame({
			orientation: { type: 'ov_radians', value: { x: 0, y: 0, z: 1, th: Math.PI / 2 } },
		})

		expect(pose.theta).toBeCloseTo(90, 6)
	})

	it('passes ov_degrees through unchanged', () => {
		const pose = new Pose().setFromFrame({
			orientation: { type: 'ov_degrees', value: { x: 0, y: 0, z: 1, th: 90 } },
		})

		expect(pose.theta).toBeCloseTo(90, 6)
	})

	it('falls back to the identity orientation when the frame has none', () => {
		const pose = new Pose(1, 2, 3, 1, 0, 0, 44).setFromFrame({
			translation: { x: 0, y: 0, z: 0 },
		})

		expect(fields(pose)).toEqual({ x: 0, y: 0, z: 0, oX: 0, oY: 0, oZ: 1, theta: 0 })
	})

	it('falls back to the identity orientation when its value is omitted', () => {
		const pose = new Pose(1, 2, 3, 1, 0, 0, 44).setFromFrame({
			orientation: { type: 'ov_degrees' },
		} as Partial<Frame>)

		expect(fields(pose)).toEqual({ x: 0, y: 0, z: 0, oX: 0, oY: 0, oZ: 1, theta: 0 })
	})

	/**
	 * Both spell the same valid config: RDK marshals `{ W, X, Y, Z }`, the editor
	 * writes `{ w, x, y, z }`, and Go's unmarshal accepts either.
	 */
	it.each([
		['lowercase', { x: Math.SQRT1_2, y: 0, z: 0, w: Math.SQRT1_2 }],
		['capitalised', { X: Math.SQRT1_2, Y: 0, Z: 0, W: Math.SQRT1_2 }],
	])('reads a %s quaternion', (_label, value) => {
		const orientation = { type: 'quaternion', value } as Frame['orientation']
		const pose = new Pose().setFromFrame({ orientation })

		expect(pose.isFinite()).toBe(true)
		expect(pose.toQuaternion().angleTo(quarterTurnAboutX)).toBeCloseTo(0, 6)
	})

	/**
	 * `R4AA` tags its fields `th/x/y/z`, the names both orientation-vector
	 * encodings use, so a misread yields a plausible wrong rotation. Hence
	 * asserting the rotation, not the fields.
	 */
	it('reads axis_angles as an axis-angle in radians', () => {
		const pose = new Pose().setFromFrame({
			orientation: { type: 'axis_angles', value: { x: 1, y: 0, z: 0, th: Math.PI / 2 } },
		})

		expect(pose.toQuaternion().angleTo(quarterTurnAboutX)).toBeCloseTo(0, 6)
	})

	/** RDK normalizes the axis inside `R4AA.ToQuat`, so an unscaled one is the same rotation. */
	it('normalizes an axis_angles axis', () => {
		const pose = new Pose().setFromFrame({
			orientation: { type: 'axis_angles', value: { x: 5, y: 0, z: 0, th: Math.PI / 2 } },
		})

		expect(pose.toQuaternion().angleTo(quarterTurnAboutX)).toBeCloseTo(0, 6)
	})

	/** A quaternion round trip is exact for the rotation but not for the tuple. */
	it('keeps ov_degrees theta at 180 rather than -180', () => {
		const pose = new Pose().setFromFrame({
			orientation: { type: 'ov_degrees', value: { x: 0, y: 0, z: 1, th: 180 } },
		})

		expect(pose.theta).toBe(180)
	})

	it('agrees across orientation representations of the same rotation', () => {
		const { x, y, z, w } = composeZYX(tiltedRoll, tiltedPitch, tiltedYaw)

		const fromQuaternion = new Pose().setFromFrame({
			orientation: { type: 'quaternion', value: { x, y, z, w } },
		})
		const fromEuler = new Pose().setFromFrame({
			orientation: {
				type: 'euler_angles',
				value: { roll: tiltedRoll, pitch: tiltedPitch, yaw: tiltedYaw },
			},
		})

		expect(fields(fromEuler)).toEqual({
			x: fromQuaternion.x,
			y: fromQuaternion.y,
			z: fromQuaternion.z,
			oX: expect.closeTo(fromQuaternion.oX, 6),
			oY: expect.closeTo(fromQuaternion.oY, 6),
			oZ: expect.closeTo(fromQuaternion.oZ, 6),
			theta: expect.closeTo(fromQuaternion.theta, 6),
		})
	})

	it('takes the frame translation as millimetres, unscaled', () => {
		// The one place the mm↔m rule does not apply: machine config is already
		// in millimetres, so nothing here multiplies by 1000.
		const pose = new Pose().setFromFrame({ translation: { x: 1000, y: -250, z: 40 } })

		expect(fields(pose)).toMatchObject({ x: 1000, y: -250, z: 40 })
	})

	it('zeroes the translation when the frame omits it', () => {
		const pose = new Pose(11, 22, 33).setFromFrame({
			orientation: { type: 'ov_degrees', value: { x: 0, y: 0, z: 1, th: 0 } },
		})

		expect(fields(pose)).toMatchObject({ x: 0, y: 0, z: 0 })
	})

	it('accepts a whole frame', () => {
		const frame: Frame = {
			parent: 'world',
			translation: { x: 100, y: 200, z: 300 },
			orientation: { type: 'ov_degrees', value: { x: 0, y: 0, z: 1, th: 45 } },
			geometry: { type: 'box', x: 1, y: 1, z: 1 },
		}

		expect(fields(new Pose().setFromFrame(frame))).toEqual({
			x: 100,
			y: 200,
			z: 300,
			oX: expect.closeTo(0, 6),
			oY: expect.closeTo(0, 6),
			oZ: expect.closeTo(1, 6),
			theta: expect.closeTo(45, 6),
		})
	})
})

describe('equals and isFinite', () => {
	const pose = () => new Pose(1, 2, 3, 0, 1, 0, 45)

	it('is equal to itself', () => {
		const subject = pose()

		expect(subject.equals(subject)).toBe(true)
	})

	it('is not equal to nothing', () => {
		expect(pose().equals(undefined)).toBe(false)
	})

	it('compares against a plain patch object, not just another Pose', () => {
		expect(pose().equals({ x: 1, y: 2, z: 3, oX: 0, oY: 1, oZ: 0, theta: 45 })).toBe(true)
	})

	it.each(FIELDS)('is not equal to a patch that omits %s', (field) => {
		// The subject is all zeros deliberately: a defaulting `?? 0` in the
		// comparison only changes the answer when the defaulted field is itself
		// zero, so a non-zero fixture would pass without testing anything.
		const zeroed = new Pose(0, 0, 0, 0, 0, 0, 0)

		expect(zeroed.equals({ ...fields(zeroed), [field]: undefined })).toBe(false)
	})

	it.each(FIELDS)('is not equal when %s differs', (field) => {
		expect(pose().equals({ ...fields(pose()), [field]: -1 })).toBe(false)
	})

	it('short-circuits identity even when a field is NaN', () => {
		const subject = new Pose(Number.NaN)

		expect(subject.equals(subject)).toBe(true)
		expect(subject.equals(fields(subject))).toBe(false)
	})

	it('is finite for an ordinary pose', () => {
		expect(pose().isFinite()).toBe(true)
	})

	it.each(FIELDS)('is not finite when %s is NaN or Infinity', (field) => {
		expect(
			pose()
				.merge({ [field]: Number.NaN })
				.isFinite()
		).toBe(false)
		expect(
			pose()
				.merge({ [field]: Number.POSITIVE_INFINITY })
				.isFinite()
		).toBe(false)
	})
})

describe('degenerate input', () => {
	it('emits a usable rotation for a zero-length orientation vector', () => {
		// Reachable from `copy({ oX: 0 })` or raw entry in PoseDetails; a NaN matrix
		// would make the geometry vanish silently.
		const pose = new Pose(1, 2, 3, 0, 0, 0, 45)

		expect(pose.toMatrix4().elements.every((element) => Number.isFinite(element))).toBe(true)
		expect(pose.toQuaternion().length()).toBeCloseTo(1, 6)
	})

	it('stores the orientation vector verbatim rather than normalizing it', () => {
		// Conversions come back unit length, so a pose is not necessarily equal to
		// its own round-trip.
		const pose = new Pose(0, 0, 0, 0, 0, 5, 35)

		expect(pose.oZ).toBe(5)
		expect(pose.equals(new Pose().setFromMatrix4(pose.toMatrix4()))).toBe(false)
	})
})
