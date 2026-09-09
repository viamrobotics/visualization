import { Quaternion } from 'three'
import { describe, expect, it } from 'vitest'

import { quatFromJson, type RawOrientation } from '../orientationJson'
import goldenFile from '../rdk-math/testdata/orientation_json_golden.json'

interface GoldenQuaternion {
	w: number
	x: number
	y: number
	z: number
}

interface GoldenCase {
	name: string
	orientation: RawOrientation
	quaternion: GoldenQuaternion | null
}

const goldenCases = goldenFile.cases as GoldenCase[]
const goldenByName = new Map(goldenCases.map((goldenCase) => [goldenCase.name, goldenCase]))

/** `quatCompare` in RDK's own spatialmath/quat_test.go holds two quaternions equal to 1e-8. */
const QUATERNION_PLACES = 8

export const expectSameRotation = (actual: Quaternion, expected: GoldenQuaternion) => {
	const q = new Quaternion(expected.x, expected.y, expected.z, expected.w)
	expect(actual.angleTo(q)).toBeLessThan(QUATERNION_PLACES)
}

const readQuaternion = (orientation: RawOrientation) => {
	const out = new Quaternion()
	const found = quatFromJson(orientation, out)

	return { out, found }
}

const orientationOf = (name: string): RawOrientation => {
	const goldenCase = goldenByName.get(name)
	if (!goldenCase) throw new Error(`the golden file no longer has a case named "${name}"`)

	return goldenCase.orientation
}

const UNSUPPORTED_TYPE_CASE = 'unsupported type, from the fixture'
const NON_NUMERIC_VALUE_CASE = 'ov_degrees with a non-numeric value, from the fixture'
const UNSET_VECTOR_CASE = 'ov_radians left entirely unset, from TestQuatDefault'

/**
 * RDK clamps an infinite norm to MaxFloat64 and still returns a unit quaternion. Three.js divides
 * by the length it measured, and `1 / Infinity` is zero, so every component collapses. Left as a
 * divergence rather than guarded: the input is a config carrying 1.8e308, which no machine writes,
 * so a guard would sit on a path no test could reach through `quatFromJson`.
 */
const NORM_OVERFLOW_CASE = 'quaternion long enough to overflow its own norm, from TestQuatNormalize'

describe('quatFromJson, against the rotations RDK derived in orientation_json_golden.json', () => {
	it('loads all 49 cases the Go generator wrote', () => {
		// Note: brittle, need input
		expect(goldenCases.length).toBe(49)
	})

	it.each(
		goldenCases.filter(
			(goldenCase): goldenCase is GoldenCase & { quaternion: GoldenQuaternion } =>
				goldenCase.quaternion !== null && goldenCase.name !== NORM_OVERFLOW_CASE
		)
	)('builds the rotation RDK read out of $name', ({ orientation, quaternion }) => {
		const { out } = readQuaternion(orientation)

		expectSameRotation(out, quaternion)
	})
})

describe('quatFromJson, reporting whether it found a rotation to apply', () => {
	it('is false for an orientation config carrying no value', () => {
		expect(readQuaternion(orientationOf('empty config, from the fixture')).found).toBe(false)
	})

	it('is true for an encoding it recognizes', () => {
		expect(readQuaternion(orientationOf('ov_degrees about +Z, from the fixture')).found).toBe(true)
	})

	it('is false for a type it has no case for', () => {
		expect(readQuaternion(orientationOf(UNSUPPORTED_TYPE_CASE)).found).toBe(false)
	})
})

describe('quatFromJson, on the configs RDK builds no orientation from', () => {
	it('leaves an unrecognized type at identity rather than guessing an encoding', () => {
		const { out } = readQuaternion(orientationOf(UNSUPPORTED_TYPE_CASE))

		expect(out.toArray()).toEqual([0, 0, 0, 1])
	})

	it('propagates a non-numeric value as NaN, having no types on the wire to reject it by', () => {
		const { out } = readQuaternion(orientationOf(NON_NUMERIC_VALUE_CASE))

		expect(out.toArray().every((component) => Number.isNaN(component))).toBe(true)
	})

	it('reads an unset orientation vector as +Z, which RDK refuses for a zero normal', () => {
		const { out, found } = readQuaternion(orientationOf(UNSET_VECTOR_CASE))

		expect(found).toBe(true)
		expect(out.toArray()).toEqual([0, 0, 0, 1])
	})

	it('pins every case RDK refused', () => {
		const pinned = [UNSUPPORTED_TYPE_CASE, NON_NUMERIC_VALUE_CASE, UNSET_VECTOR_CASE]

		expect(pinned.toSorted()).toEqual(
			goldenCases
				.filter((goldenCase) => goldenCase.quaternion === null)
				.map((goldenCase) => goldenCase.name)
				.toSorted()
		)
	})
})

describe('quatFromJson, on a quaternion whose norm overflows a float', () => {
	it('collapses to a zero-length quaternion where RDK clamps and stays a unit', () => {
		const { out } = readQuaternion(orientationOf(NORM_OVERFLOW_CASE))

		expect(out.length()).toBe(0)
		expect(goldenByName.get(NORM_OVERFLOW_CASE)?.quaternion).toEqual({
			w: 0,
			x: 1,
			y: 5.562_684_646_268_003e-309,
			z: 0,
		})
	})
})
