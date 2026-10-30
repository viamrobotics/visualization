import { Euler, Quaternion } from 'three'
import { describe, expect, it } from 'vitest'

import goldenFile from '../../../../tools/rdk-golden/math/testdata/orientation_vector_golden.json'
import { OrientationVector } from '../OrientationVector'
import { expectSameRotation } from './orientationJsonGolden.spec'

interface GoldenQuaternion {
	w: number
	x: number
	y: number
	z: number
}

interface GoldenVector {
	th: number
	x: number
	y: number
	z: number
}

interface GoldenEuler {
	roll: number
	pitch: number
	yaw: number
}

const fromVectorCases = goldenFile.fromVector as {
	name: string
	orientationVector: GoldenVector
	quaternion: GoldenQuaternion
	eulerAngles: GoldenEuler
}[]

const fromQuaternionCases = goldenFile.fromQuaternion as {
	name: string
	quaternion: GoldenQuaternion
	orientationVector: GoldenVector
}[]

const normalizeCases = goldenFile.normalize as {
	name: string
	input: GoldenVector
	normalized: GoldenVector
}[]

/** RDK's own quatCompare in spatialmath/quat_test.go holds two quaternions equal to 1e-8. */
const PLACES = 8

const vectorOf = ({ th, x, y, z }: GoldenVector) => new OrientationVector(x, y, z, th)

const componentsOf = (q: Quaternion): GoldenQuaternion => ({ w: q.w, x: q.x, y: q.y, z: q.z })

describe('OrientationVector.toQuaternion, against the quaternions RDK derived', () => {
	it('reads all 23 vector cases the Go generator wrote', () => {
		expect(fromVectorCases.length).toBe(23)
	})

	it.each(fromVectorCases)(
		'builds RDKs quaternion for a vector $name',
		({ orientationVector, quaternion }) => {
			const out = vectorOf(orientationVector).toQuaternion(new Quaternion())

			expectSameRotation(out, quaternion)
		}
	)
})

describe('OrientationVector.setFromQuaternion, against the vectors RDK read out of a quaternion', () => {
	it('reads all 16 quaternion cases the Go generator wrote', () => {
		expect(fromQuaternionCases.length).toBe(16)
	})

	it.each(fromQuaternionCases)(
		'reads RDKs vector out of a quaternion $name',
		({ quaternion, orientationVector }) => {
			const out = new OrientationVector().setFromQuaternion(
				new Quaternion(quaternion.x, quaternion.y, quaternion.z, quaternion.w)
			)

			expect(out.x).toBeCloseTo(orientationVector.x, PLACES)
			expect(out.y).toBeCloseTo(orientationVector.y, PLACES)
			expect(out.z).toBeCloseTo(orientationVector.z, PLACES)
			expect(out.th).toBeCloseTo(orientationVector.th, PLACES)
		}
	)
})

describe('OrientationVector normalization, against what RDKs Normalize leaves behind', () => {
	it.each(normalizeCases)('scales $name to a unit vector', ({ input, normalized }) => {
		const out = vectorOf(input)

		expect(out.x).toBeCloseTo(normalized.x, PLACES)
		expect(out.y).toBeCloseTo(normalized.y, PLACES)
		expect(out.z).toBeCloseTo(normalized.z, PLACES)
		expect(out.th).toBeCloseTo(normalized.th, PLACES)
	})
})

/**
 * An euler triple is not a unique encoding of a rotation. RDK and Three.js disagree by
 * a full turn on one of these vectors, and at gimbal lock they are free to pick different triples
 * entirely, so the angles are compared through the rotation they encode. The order is pinned to 'ZYX'.
 */
describe('OrientationVector.toEuler, against the euler angles RDK derived', () => {
	it.each(fromVectorCases)(
		'builds RDKs rotation as euler angles for a vector $name',
		({ orientationVector, eulerAngles }) => {
			const out = vectorOf(orientationVector).toEuler(new Euler())

			expect(out.order).toBe('ZYX')

			const rdkRotation = new Quaternion().setFromEuler(
				new Euler(eulerAngles.roll, eulerAngles.pitch, eulerAngles.yaw, 'ZYX')
			)
			expectSameRotation(new Quaternion().setFromEuler(out), componentsOf(rdkRotation))
		}
	)
})
