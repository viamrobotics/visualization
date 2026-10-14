import { describe, expect, it } from 'vitest'

import { generateBoundsGeometries } from '$lib/boundsGeometries'
import { BOUNDS_FACES, type BoundsHint } from '$lib/obstacleAttributes'

const hint: BoundsHint = {
	type: 'bounds',
	x_mm: 400,
	y_mm: 600,
	z_mm: 800,
	wall_thickness_mm: 10,
	exclude: [],
}

describe('generateBoundsGeometries', () => {
	it('generates each wall in face order with its translation and box dimensions', () => {
		expect(generateBoundsGeometries(hint)).toEqual([
			{ label: 'x_max', type: 'box', x: 10, y: 620, z: 820, translation: { x: 205, y: 0, z: 0 } },
			{ label: 'x_min', type: 'box', x: 10, y: 620, z: 820, translation: { x: -205, y: 0, z: 0 } },
			{ label: 'y_max', type: 'box', x: 420, y: 10, z: 820, translation: { x: 0, y: 305, z: 0 } },
			{ label: 'y_min', type: 'box', x: 420, y: 10, z: 820, translation: { x: 0, y: -305, z: 0 } },
			{ label: 'floor', type: 'box', x: 420, y: 620, z: 10, translation: { x: 0, y: 0, z: -405 } },
			{ label: 'ceiling', type: 'box', x: 420, y: 620, z: 10, translation: { x: 0, y: 0, z: 405 } },
		])
	})

	it('follows BOUNDS_FACES order', () => {
		expect(generateBoundsGeometries(hint).map((geometry) => geometry.label)).toEqual([
			...BOUNDS_FACES,
		])
	})

	it('omits an excluded face', () => {
		const labels = generateBoundsGeometries({ ...hint, exclude: ['ceiling'] }).map(
			(geometry) => geometry.label
		)

		expect(labels).toEqual(['x_max', 'x_min', 'y_max', 'y_min', 'floor'])
	})

	it('returns no geometries when every face is excluded', () => {
		expect(generateBoundsGeometries({ ...hint, exclude: [...BOUNDS_FACES] })).toEqual([])
	})

	it('leaves orientation off every geometry', () => {
		const withOrientation = generateBoundsGeometries(hint).filter(
			(geometry) => 'orientation' in geometry
		)

		expect(withOrientation).toEqual([])
	})

	it('never emits negative zero', () => {
		const values = generateBoundsGeometries(hint).flatMap((geometry) => [
			geometry.translation?.x,
			geometry.translation?.y,
			geometry.translation?.z,
		])

		expect(values.filter((value) => Object.is(value, -0))).toEqual([])
	})
})
