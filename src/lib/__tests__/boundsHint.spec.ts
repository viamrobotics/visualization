import { describe, expect, it } from 'vitest'

import type { BoundsHint, ObstacleGeometryConfig } from '$lib/obstacleAttributes'

import { generateBoundsGeometries } from '$lib/boundsGeometries'
import { boundsHintFromWalls, boundsWallsMatch, parseBoundsHint } from '$lib/boundsHint'

const hint: BoundsHint = {
	type: 'bounds',
	x_mm: 400,
	y_mm: 600,
	z_mm: 800,
	wall_thickness_mm: 10,
	exclude: [],
}

describe('parseBoundsHint', () => {
	it('accepts a hint with a positive interior and known walls', () => {
		expect(parseBoundsHint({ ...hint, exclude: ['floor'] })).toEqual({
			...hint,
			exclude: ['floor'],
		})
	})

	it.each([
		{ field: 'type', value: 'complex' },
		{ field: 'x_mm', value: 0 },
		{ field: 'y_mm', value: -600 },
		{ field: 'z_mm', value: Number.NaN },
		{ field: 'wall_thickness_mm', value: 0 },
		{ field: 'exclude', value: ['roof'] },
		{ field: 'exclude', value: 'ceiling' },
	])('rejects a hint whose $field is $value', ({ field, value }) => {
		expect(parseBoundsHint({ ...hint, [field]: value })).toBeUndefined()
	})

	it.each([undefined, null, 'bounds', []])('rejects %j', (value) => {
		expect(parseBoundsHint(value)).toBeUndefined()
	})
})

describe('boundsWallsMatch', () => {
	it('matches the walls the hint generates, in any order', () => {
		expect(boundsWallsMatch(hint, generateBoundsGeometries(hint).toReversed())).toBe(true)
	})

	it('matches walls that differ from the generated ones only by float noise', () => {
		const walls = generateBoundsGeometries(hint).map((wall) =>
			wall.type === 'box' ? { ...wall, x: wall.x + 1e-9 } : wall
		)

		expect(boundsWallsMatch(hint, walls)).toBe(true)
	})

	it('does not match a wall resized by hand', () => {
		const [first, ...rest] = generateBoundsGeometries(hint)

		expect(boundsWallsMatch(hint, [{ ...first!, x: 11 } as ObstacleGeometryConfig, ...rest])).toBe(
			false
		)
	})

	it('does not match when a wall is missing', () => {
		expect(boundsWallsMatch(hint, generateBoundsGeometries(hint).slice(1))).toBe(false)
	})

	it('does not match when a wall is repeated', () => {
		const walls = generateBoundsGeometries({ ...hint, exclude: ['ceiling'] })

		expect(boundsWallsMatch({ ...hint, exclude: ['ceiling'] }, [...walls, walls[0]!])).toBe(false)
	})
})

describe('boundsHintFromWalls', () => {
	it.each(['x_max', 'x_min', 'y_max', 'y_min', 'floor', 'ceiling'])(
		'recovers the hint when the %s wall comes first',
		(face) => {
			const walls = generateBoundsGeometries(hint)
			const first = walls.findIndex((wall) => wall.label === face)
			const rotated = [...walls.slice(first), ...walls.slice(0, first)]

			expect(boundsHintFromWalls(rotated)).toEqual(hint)
		}
	)

	it('recovers the walls left out', () => {
		const openTop: BoundsHint = { ...hint, exclude: ['x_min', 'ceiling'] }

		expect(boundsHintFromWalls(generateBoundsGeometries(openTop))).toEqual(openTop)
	})

	it('recovers fractional sizes without float noise', () => {
		const fractional: BoundsHint = { ...hint, x_mm: 412.3, y_mm: 0.7, wall_thickness_mm: 7.1 }

		expect(boundsHintFromWalls(generateBoundsGeometries(fractional))).toEqual(fractional)
	})

	it('recovers a lone floor wall as Bounds with the other walls left out', () => {
		const floorOnly: BoundsHint = {
			...hint,
			exclude: ['x_max', 'x_min', 'y_max', 'y_min', 'ceiling'],
		}

		expect(boundsHintFromWalls(generateBoundsGeometries(floorOnly))).toEqual(floorOnly)
	})

	it('finds nothing for a box labeled as a wall but sitting at the origin', () => {
		const floor: ObstacleGeometryConfig = { label: 'floor', type: 'box', x: 100, y: 100, z: 10 }

		expect(boundsHintFromWalls([floor])).toBeUndefined()
	})

	it('finds nothing when a wall was moved by hand', () => {
		const [first, ...rest] = generateBoundsGeometries(hint)
		const moved = { ...first!, translation: { x: 999, y: 0, z: 0 } }

		expect(boundsHintFromWalls([moved, ...rest])).toBeUndefined()
	})

	it.each([
		{ geometries: [{ label: 'floor', type: 'sphere', r: 5 }], label: 'a wall that is not a box' },
		{ geometries: [{ label: 'post', type: 'box', x: 1, y: 1, z: 1 }], label: 'an unknown label' },
		{ geometries: [], label: 'no geometries' },
	])('finds nothing for $label', ({ geometries }) => {
		expect(boundsHintFromWalls(geometries as ObstacleGeometryConfig[])).toBeUndefined()
	})
})
