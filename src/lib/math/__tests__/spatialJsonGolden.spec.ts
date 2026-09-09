import { describe, expect, it } from 'vitest'

import goldenFile from '../rdk-math/testdata/geometry_center_golden.json'
import { geometryCenterInFrame, type RawOrientation, type Vec3Json } from '../spatialJson'

interface GoldenPose {
	x: number
	y: number
	z: number
	oX: number
	oY: number
	oZ: number
	theta: number
}

const goldenCases = goldenFile.cases as {
	name: string
	geometryTranslation?: Vec3Json
	geometryOrientation?: RawOrientation
	frameTranslation?: Vec3Json
	frameOrientation?: RawOrientation
	center: GoldenPose
}[]

/**
 * Loose next to the 1e-8 the other goldens use, because these values are millimetres rather than
 * unit components.
 */
const MILLIMETRE_PLACES = 6

/** Component tolerance for the orientation vector, which is a unit vector rather than a length. */
const UNIT_PLACES = 9

describe('geometryCenterInFrame, against the poses RDKs PoseBetween derived', () => {
	it('reads all 13 cases the Go generator wrote', () => {
		// Note: brittle, need input
		expect(goldenCases.length).toBe(13)
	})

	it.each(goldenCases)('undoes the frame pose for $name', (goldenCase) => {
		const center = geometryCenterInFrame(
			goldenCase.geometryTranslation,
			goldenCase.geometryOrientation,
			{ translation: goldenCase.frameTranslation, orientation: goldenCase.frameOrientation }
		)

		const { center: expected } = goldenCase
		expect(center.x).toBeCloseTo(expected.x, MILLIMETRE_PLACES)
		expect(center.y).toBeCloseTo(expected.y, MILLIMETRE_PLACES)
		expect(center.z).toBeCloseTo(expected.z, MILLIMETRE_PLACES)
		expect(center.oX).toBeCloseTo(expected.oX, UNIT_PLACES)
		expect(center.oY).toBeCloseTo(expected.oY, UNIT_PLACES)
		expect(center.oZ).toBeCloseTo(expected.oZ, UNIT_PLACES)
		expect(center.theta).toBeCloseTo(expected.theta, UNIT_PLACES)
	})
})
