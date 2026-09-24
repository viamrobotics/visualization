import { describe, expect, it, vi } from 'vitest'

import type { Frame } from '$lib/frame'

import { createGeometryFromFrame } from '$lib/geometry'

/**
 * Every geometry below is one rdk accepts, so none may throw and each resolves
 * the way `GeometryConfig.ParseConfig` would. The cast is what a config does.
 */
const asFrame = (geometry: unknown): Partial<Frame> => ({ geometry }) as Partial<Frame>

/** Shape plus the numbers behind it: a box built from the wrong fields still reads as a box. */
const shapeOf = (geometry: unknown) => {
	const result = createGeometryFromFrame(asFrame(geometry))
	if (!result) return undefined

	const type = result.geometryType
	switch (type.case) {
		case 'box': {
			return {
				case: type.case,
				x: type.value.dimsMm?.x,
				y: type.value.dimsMm?.y,
				z: type.value.dimsMm?.z,
			}
		}
		case 'capsule': {
			return { case: type.case, r: type.value.radiusMm, l: type.value.lengthMm }
		}
		case 'sphere': {
			return { case: type.case, r: type.value.radiusMm }
		}
		default: {
			return { case: type.case }
		}
	}
}

describe('createGeometryFromFrame', () => {
	describe('shapes the frame editor writes', () => {
		it.each([
			[
				{ type: 'box', x: 1, y: 2, z: 3 },
				{ case: 'box', x: 1, y: 2, z: 3 },
			],
			[
				{ type: 'sphere', r: 4 },
				{ case: 'sphere', r: 4 },
			],
			[
				{ type: 'capsule', r: 5, l: 60 },
				{ case: 'capsule', r: 5, l: 60 },
			],
		])('reads %j', (geometry, expected) => {
			expect(shapeOf(geometry)).toEqual(expected)
		})

		it.each([
			['an explicit none', { type: 'none' }],
			['an absent geometry', undefined],
		])('resolves %s to no geometry', (_label, geometry) => {
			expect(createGeometryFromFrame(asFrame(geometry))).toBeUndefined()
		})
	})

	/** A capsule sets `r` as well as `l`, which is why rdk checks length first. */
	describe('an untyped geometry, the way rdk infers it', () => {
		it.each([
			[
				{ x: 10, y: 10, z: 10 },
				{ case: 'box', x: 10, y: 10, z: 10 },
			],
			[
				{ x: 0, y: 0, z: 5 },
				{ case: 'box', x: 0, y: 0, z: 5 },
			],
			[
				{ r: 3, l: 40 },
				{ case: 'capsule', r: 3, l: 40 },
			],
			[{ r: 60 }, { case: 'sphere', r: 60 }],
			[
				{ type: '', r: 60 },
				{ case: 'sphere', r: 60 },
			],
		])('infers %j', (geometry, expected) => {
			expect(shapeOf(geometry)).toEqual(expected)
		})

		it.each([
			['nothing is set', {}],
			['only a negative radius is set', { r: -1 }],
		])('yields no geometry when %s', (_label, geometry) => {
			expect(createGeometryFromFrame(asFrame(geometry))).toBeUndefined()
		})
	})

	/** Dropping these is the intent; the warning is what keeps it from being silent. */
	describe('shapes the SDK union cannot carry', () => {
		it.each([
			['cylinder', { type: 'cylinder', r: 10, l: 100 }],
			['point', { type: 'point' }],
			['mesh', { type: 'mesh', mesh_data: 'AAAA', mesh_content_type: 'ply' }],
		])('skips a %s and says so', (type, geometry) => {
			const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)

			expect(createGeometryFromFrame(asFrame(geometry))).toBeUndefined()
			expect(warn).toHaveBeenCalledWith(expect.stringContaining(`"${type}"`))
		})
	})
})
