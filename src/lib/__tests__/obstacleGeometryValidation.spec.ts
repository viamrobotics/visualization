import { describe, expect, it } from 'vitest'

import type { ObstacleGeometryConfig } from '$lib/obstacleAttributes'

import { validateObstacleGeometries } from '$lib/obstacleGeometryValidation'

const box = (label?: string): ObstacleGeometryConfig => ({ type: 'box', x: 1, y: 1, z: 1, label })

describe('validateObstacleGeometries', () => {
	it('reports an empty list against no entry', () => {
		const issues = validateObstacleGeometries([])
		expect(issues).toHaveLength(1)
		expect(issues[0].index).toBeUndefined()
		expect(issues[0].message).toMatch(/at least one geometry/)
	})

	it('rejects a negative box dimension', () => {
		const issues = validateObstacleGeometries([{ type: 'box', x: 1, y: -1, z: 1 }])
		expect(issues.map((issue) => issue.index)).toEqual([0])
		expect(issues[0].message).toMatch(/box/)
	})

	it('accepts a zero box dimension', () => {
		expect(validateObstacleGeometries([{ type: 'box', x: 0, y: 1, z: 1 }])).toEqual([])
	})

	it('rejects a sphere radius that is not positive', () => {
		expect(validateObstacleGeometries([{ type: 'sphere', r: 0 }])).toHaveLength(1)
		expect(validateObstacleGeometries([{ type: 'sphere', r: -2 }])).toHaveLength(1)
	})

	it('rejects a capsule radius that is not positive', () => {
		const issues = validateObstacleGeometries([{ type: 'capsule', r: 0, l: 10 }])
		expect(issues[0].message).toMatch(/radius/)
	})

	it('rejects a capsule length that is not positive', () => {
		const issues = validateObstacleGeometries([{ type: 'capsule', r: 1, l: 0 }])
		expect(issues[0].message).toMatch(/length must be greater/)
	})

	it('rejects a capsule shorter than twice its radius, and accepts exactly twice', () => {
		const short = validateObstacleGeometries([{ type: 'capsule', r: 5, l: 9 }])
		expect(short[0].message).toMatch(/twice/)
		expect(validateObstacleGeometries([{ type: 'capsule', r: 5, l: 10 }])).toEqual([])
	})

	it('rejects the reserved label world', () => {
		const issues = validateObstacleGeometries([box('world')])
		expect(issues[0].message).toMatch(/reserved/)
	})

	it('rejects a label containing a colon', () => {
		const issues = validateObstacleGeometries([box('a:b')])
		expect(issues[0].message).toMatch(/:/)
	})

	it('flags every repeat of a label after the first', () => {
		const issues = validateObstacleGeometries([box('a'), box('a'), box('b'), box('a')])
		expect(issues.map((issue) => issue.index)).toEqual([1, 3])
	})

	it('allows an empty or missing label', () => {
		expect(validateObstacleGeometries([box('')])).toEqual([])
		expect(validateObstacleGeometries([box(undefined)])).toEqual([])
	})

	it('allows two empty labels', () => {
		expect(validateObstacleGeometries([box(''), box(''), box()])).toEqual([])
	})

	it('does not shape-check types it does not author', () => {
		const cylinder = { type: 'cylinder', r: -1, l: -1 } as unknown as ObstacleGeometryConfig
		const untyped = {} as unknown as ObstacleGeometryConfig
		expect(validateObstacleGeometries([cylinder, untyped])).toEqual([])
	})

	it('reports the first problem per entry only', () => {
		const issues = validateObstacleGeometries([{ type: 'sphere', r: 0, label: 'world' }])
		expect(issues).toHaveLength(1)
		expect(issues[0].message).toMatch(/radius/)
	})

	it('accepts a valid mixed list', () => {
		expect(
			validateObstacleGeometries([
				box('a'),
				{ type: 'sphere', r: 3, label: 'b' },
				{ type: 'capsule', r: 2, l: 10 },
			])
		).toEqual([])
	})
})
