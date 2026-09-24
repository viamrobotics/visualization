import { describe, expect, it } from 'vitest'

import {
	isDHModel,
	parseKinematicsGeometry,
	type RawKinematicsGeometry,
} from '../kinematicsTransform'

/**
 * These cover the wire boundary: rdk marshals `LinkConfig` / `GeometryConfig`
 * with Go's capitalisation quirks (`{ X, Y, Z }` translations, a bare `Label`)
 * and infers geometry shape from whichever params are set when `type` is
 * omitted. Orientation decoding and the geometry-center frame convention live in
 * `spatialJson.spec.ts`; what's asserted here is the reshaping and the model
 * hierarchy questions.
 */

describe('parseKinematicsGeometry', () => {
	const geometry = (raw: RawKinematicsGeometry) => parseKinematicsGeometry(raw)

	it('reads the Go-capitalised Label', () => {
		expect(geometry({ type: 'sphere', r: 5, Label: 'wrist' }).label).toBe('wrist')
	})

	it('defaults a missing label to empty', () => {
		expect(geometry({ type: 'sphere', r: 5 }).label).toBe('')
	})

	it('offsets the geometry by its own translation', () => {
		const parsed = geometry({ type: 'sphere', r: 5, translation: { X: 1, Y: 2, Z: 3 } })

		expect(parsed.center?.x).toBe(1)
		expect(parsed.center?.y).toBe(2)
		expect(parsed.center?.z).toBe(3)
	})

	describe('with an explicit type', () => {
		it('reads a box', () => {
			expect(geometry({ type: 'box', x: 1, y: 2, z: 3 }).geometryType).toEqual({
				case: 'box',
				value: { dimsMm: { x: 1, y: 2, z: 3 } },
			})
		})

		it('reads a sphere', () => {
			expect(geometry({ type: 'sphere', r: 7 }).geometryType).toEqual({
				case: 'sphere',
				value: { radiusMm: 7 },
			})
		})

		it('reads a capsule', () => {
			expect(geometry({ type: 'capsule', r: 2, l: 9 }).geometryType).toEqual({
				case: 'capsule',
				value: { radiusMm: 2, lengthMm: 9 },
			})
		})

		it('trusts the type over the params — a capsule missing its length stays a capsule', () => {
			expect(geometry({ type: 'capsule', r: 2 }).geometryType).toEqual({
				case: 'capsule',
				value: { radiusMm: 2, lengthMm: 0 },
			})
		})

		it('reads a cylinder, capping it because rdk omits the field for a solid one', () => {
			expect(geometry({ type: 'cylinder', r: 2, l: 9 }).geometryType).toEqual({
				case: 'cylinder',
				value: { radiusMm: 2, lengthMm: 9, capped: true },
			})
		})

		it('leaves a cylinder marked capped: false open', () => {
			expect(geometry({ type: 'cylinder', r: 2, l: 9, capped: false }).geometryType).toEqual({
				case: 'cylinder',
				value: { radiusMm: 2, lengthMm: 9, capped: false },
			})
		})

		it('has no case for shapes the geometry union cannot express', () => {
			expect(geometry({ type: 'point' }).geometryType.case).toBeUndefined()
		})
	})

	/** Mirrors rdk's `GeometryConfig.ParseConfig` `UnknownType` branch. */
	describe('with no type', () => {
		it('infers a box from any non-zero dimension', () => {
			expect(geometry({ z: 3 }).geometryType).toEqual({
				case: 'box',
				value: { dimsMm: { x: 0, y: 0, z: 3 } },
			})
		})

		it('prefers a box over a capsule when both are specified', () => {
			expect(geometry({ x: 1, y: 1, z: 1, r: 2, l: 9 }).geometryType.case).toBe('box')
		})

		it('infers a capsule from a length', () => {
			expect(geometry({ r: 2, l: 9 }).geometryType).toEqual({
				case: 'capsule',
				value: { radiusMm: 2, lengthMm: 9 },
			})
		})

		it('infers a sphere from a radius alone', () => {
			expect(geometry({ r: 2 }).geometryType).toEqual({
				case: 'sphere',
				value: { radiusMm: 2 },
			})
		})

		it('infers nothing from an empty config', () => {
			expect(geometry({}).geometryType.case).toBeUndefined()
		})
	})

	/**
	 * A link geometry's offset is measured from the link's parent, so passing the
	 * link's own pose is what keeps it from being applied twice. Without it the
	 * offset is read as already-local — correct for an obstacle, wrong for a link.
	 */
	describe('relative to the owning link', () => {
		it('subtracts the link pose when one is given', () => {
			const parsed = parseKinematicsGeometry(
				{ type: 'sphere', r: 5, translation: { X: 15, Y: 0, Z: 0 } },
				{ translation: { X: 10, Y: 0, Z: 0 } }
			)

			expect(parsed.center?.x).toBeCloseTo(5)
		})

		it('treats the offset as already-local when no link pose is given', () => {
			const parsed = parseKinematicsGeometry({
				type: 'sphere',
				r: 5,
				translation: { X: 15, Y: 0, Z: 0 },
			})

			expect(parsed.center?.x).toBeCloseTo(15)
		})
	})
})

/**
 * rdk builds a `"DH"` model from `dhParams` instead of `links`/`joints`, so one
 * yields no frames at all. Detecting it is what turns silence into a warning.
 */
describe('isDHModel', () => {
	it('recognises the declared param type', () => {
		expect(isDHModel({ kinematic_param_type: 'DH', dhParams: [{}] })).toBe(true)
	})

	it('recognises dhParams standing in for absent links', () => {
		expect(isDHModel({ dhParams: [{}, {}] })).toBe(true)
	})

	it('leaves an SVA model alone', () => {
		expect(isDHModel({ kinematic_param_type: 'SVA', links: [{ id: 'base' }] })).toBe(false)
	})

	it('leaves an untyped link model alone', () => {
		expect(isDHModel({ links: [{ id: 'base' }] })).toBe(false)
	})
})
