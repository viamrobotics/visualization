import { describe, expect, it } from 'vitest'

import type { PartComponent } from '$lib/hooks/usePartConfig.svelte'
import type { BoundsHint, ObstacleGeometryConfig } from '$lib/obstacleAttributes'

import { generateBoundsGeometries } from '$lib/boundsGeometries'
import { obstacleEditorHint, obstacleEditorType } from '$lib/obstacleEditorType'

const componentWith = (geometries: unknown, visualizer?: unknown): PartComponent => ({
	name: 'obstacle-1',
	model: 'rdk:builtin:obstacle',
	attributes: { geometries },
	visualizer: visualizer as PartComponent['visualizer'],
})

const shape = { type: 'box', x: 1, y: 1, z: 1 }

describe('obstacleEditorType with a hint', () => {
	it.each([
		{ geometry: shape, label: 'a bare geometry' },
		{ geometry: { ...shape, label: 'crate' }, label: 'a labeled geometry' },
		{ geometry: { ...shape, translation: { x: 5, y: 6, z: 7 } }, label: 'an offset geometry' },
	])('returns simple for a simple hint and $label', ({ geometry }) => {
		expect(obstacleEditorType(componentWith([geometry], { type: 'simple' }))).toBe('simple')
	})

	it('returns complex for a complex hint, even with one geometry', () => {
		expect(obstacleEditorType(componentWith([shape], { type: 'complex' }))).toBe('complex')
	})

	it('returns complex for a simple hint over several geometries', () => {
		const geometries = [shape, { ...shape, label: 'other' }]

		expect(obstacleEditorType(componentWith(geometries, { type: 'simple' }))).toBe('complex')
	})

	it('reads no hint from inside the attributes, where it used to live', () => {
		const component: PartComponent = {
			name: 'obstacle-1',
			model: 'rdk:builtin:obstacle',
			attributes: { geometries: [shape], visualizer: { type: 'complex' } },
		}

		expect(obstacleEditorType(component)).toBe('simple')
	})
})

describe('obstacleEditorType without a usable hint', () => {
	it('returns simple for one geometry at the obstacle origin', () => {
		expect(obstacleEditorType(componentWith([shape]))).toBe('simple')
	})

	it('returns simple for one geometry whose offset is written out as none', () => {
		const geometry = {
			...shape,
			translation: { x: 0, y: 0, z: 0 },
			orientation: { type: 'ov_degrees', value: { x: 0, y: 0, z: 1, th: 0 } },
		}

		expect(obstacleEditorType(componentWith([geometry]))).toBe('simple')
	})

	it.each([
		{ offset: { translation: { x: 0, y: 0, z: 200 } }, label: 'moved' },
		{
			offset: { orientation: { type: 'ov_degrees', value: { x: 0, y: 0, z: 1, th: 45 } } },
			label: 'turned',
		},
	])('returns complex for one geometry $label off the obstacle origin', ({ offset }) => {
		expect(obstacleEditorType(componentWith([{ ...shape, ...offset }]))).toBe('complex')
	})

	it('returns complex for several geometries that are not walls', () => {
		expect(obstacleEditorType(componentWith([shape, { ...shape, label: 'other' }]))).toBe('complex')
	})

	it.each([null, 'simple', 3, {}])(
		'reads the type from the geometries for a hint of %j',
		(hint) => {
			expect(obstacleEditorType(componentWith([shape], hint))).toBe('simple')
		}
	)

	it.each([
		{ geometries: [], label: 'no geometries' },
		{ geometries: 'nope', label: 'geometries that are not a list' },
		{ geometries: undefined, label: 'no geometries key' },
	])('returns complex for $label', ({ geometries }) => {
		expect(obstacleEditorType(componentWith(geometries))).toBe('complex')
	})
})

describe('obstacleEditorHint for walls', () => {
	const boundsHint: BoundsHint = {
		type: 'bounds',
		x_mm: 400,
		y_mm: 600,
		z_mm: 800,
		wall_thickness_mm: 10,
		exclude: ['ceiling'],
	}

	const walls = (): ObstacleGeometryConfig[] => generateBoundsGeometries(boundsHint)

	it('returns the stored hint for the walls it generates', () => {
		expect(obstacleEditorHint(componentWith(walls(), boundsHint))).toEqual(boundsHint)
	})

	it('returns bounds when the walls are stored in another order', () => {
		expect(obstacleEditorType(componentWith(walls().toReversed(), boundsHint))).toBe('bounds')
	})

	it('reads the hint from the walls when none is stored', () => {
		expect(obstacleEditorHint(componentWith(walls()))).toEqual(boundsHint)
	})

	it('reads the hint from the walls when the stored one is out of date', () => {
		const geometries = generateBoundsGeometries({ ...boundsHint, exclude: [] })

		expect(obstacleEditorHint(componentWith(geometries, boundsHint))).toEqual({
			...boundsHint,
			exclude: [],
		})
	})

	it.each([
		{ field: 'x_mm', value: 0 },
		{ field: 'wall_thickness_mm', value: Number.NaN },
		{ field: 'exclude', value: ['roof'] },
	])('reads the hint from the walls when the stored $field is $value', ({ field, value }) => {
		expect(obstacleEditorHint(componentWith(walls(), { ...boundsHint, [field]: value }))).toEqual(
			boundsHint
		)
	})

	it('returns complex when one wall was moved by hand', () => {
		const [first, ...rest] = walls()
		const geometries = [{ ...first, translation: { x: 999, y: 0, z: 0 } }, ...rest]

		expect(obstacleEditorType(componentWith(geometries, boundsHint))).toBe('complex')
	})
})
