import { describe, expect, it } from 'vitest'

import type { ObstacleGeometryConfig } from '$lib/obstacleAttributes'

import {
	addObstacleGeometry,
	patchObstacleGeometry,
	removeObstacleGeometry,
} from '$lib/obstacleGeometryList'

const box = (label?: string): ObstacleGeometryConfig => ({ type: 'box', x: 1, y: 2, z: 3, label })

describe('addObstacleGeometry', () => {
	it('appends a default box labeled shape-1 to an empty list', () => {
		const result = addObstacleGeometry([])
		expect(result.label).toBe('shape-1')
		expect(result.geometries).toEqual([{ label: 'shape-1', type: 'box', x: 100, y: 100, z: 100 }])
	})

	it('picks the first free number', () => {
		const result = addObstacleGeometry([box('shape-1'), box('shape-3')])
		expect(result.label).toBe('shape-2')
		expect(result.geometries).toHaveLength(3)
	})

	it('does not mutate its input', () => {
		const input = [box('shape-1')]
		const result = addObstacleGeometry(input)
		expect(input).toHaveLength(1)
		expect(result.geometries).not.toBe(input)
	})
})

describe('removeObstacleGeometry', () => {
	it('removes the entry at the index without mutating', () => {
		const input = [box('a'), box('b'), box('c')]
		const result = removeObstacleGeometry(input, 1)
		expect(result.map((geometry) => geometry.label)).toEqual(['a', 'c'])
		expect(input).toHaveLength(3)
	})

	it('keeps the contents for an out-of-range index', () => {
		const input = [box('a')]
		expect(removeObstacleGeometry(input, 5)).toEqual(input)
		expect(removeObstacleGeometry(input, -1)).toEqual(input)
	})

	it('allows removing the last entry', () => {
		expect(removeObstacleGeometry([box('a')], 0)).toEqual([])
	})
})

describe('patchObstacleGeometry', () => {
	it('shallow-merges the patch into the target only', () => {
		const input = [box('a'), box('b')]
		const result = patchObstacleGeometry(input, 1, {
			label: 'renamed',
			translation: { x: 1, y: 2, z: 3 },
		})
		expect(result[0]).toEqual(input[0])
		expect(result[1]).toMatchObject({ label: 'renamed', x: 1, translation: { x: 1, y: 2, z: 3 } })
	})

	it('does not mutate its input', () => {
		const input = [box('a')]
		const snapshot = structuredClone(input)
		const result = patchObstacleGeometry(input, 0, { label: 'b' })
		expect(input).toEqual(snapshot)
		expect(result[0]).not.toBe(input[0])
	})

	it('deletes a key patched to undefined', () => {
		const input: ObstacleGeometryConfig[] = [{ ...box('a'), translation: { x: 1, y: 2, z: 3 } }]
		const result = patchObstacleGeometry(input, 0, { label: undefined, translation: undefined })
		expect('label' in result[0]).toBe(false)
		expect('translation' in result[0]).toBe(false)
	})

	it('drops the old shape fields when the type changes', () => {
		const input: ObstacleGeometryConfig[] = [
			{
				...box('a'),
				translation: { x: 1, y: 2, z: 3 },
				orientation: { type: 'ov_degrees', value: { x: 0, y: 0, z: 1, th: 0 } },
			},
		]
		const result = patchObstacleGeometry(input, 0, {
			type: 'sphere',
			r: 5,
		} as ObstacleGeometryPatchLike)
		expect(result[0]).toEqual({
			label: 'a',
			translation: { x: 1, y: 2, z: 3 },
			orientation: input[0].orientation,
			type: 'sphere',
			r: 5,
		})
	})

	it('returns the same contents for an out-of-range index', () => {
		const input = [box('a')]
		expect(patchObstacleGeometry(input, 3, { label: 'x' })).toEqual(input)
	})
})

type ObstacleGeometryPatchLike = Parameters<typeof patchObstacleGeometry>[2]
