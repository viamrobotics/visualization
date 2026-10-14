import { describe, expect, it } from 'vitest'

import type { ObstacleGeometryConfig } from '$lib/obstacleAttributes'

import { obstacleEditError } from '$lib/obstacleEditError'
import { patchObstacleGeometry, removeObstacleGeometry } from '$lib/obstacleGeometryList'

const capsule = (r: number, l: number): ObstacleGeometryConfig => ({ type: 'capsule', r, l })
const box = (label: string): ObstacleGeometryConfig => ({ label, type: 'box', x: 1, y: 1, z: 1 })

describe('obstacleEditError', () => {
	it('lets an edit through while another entry stays broken', () => {
		const previous = [capsule(10, 5), capsule(10, 5)]
		const next = patchObstacleGeometry(previous, 0, { l: 20 })

		expect(obstacleEditError(previous, next, 0, 'shape')).toBeUndefined()
	})

	it('lets a broken entry be fixed one field at a time', () => {
		const previous = [capsule(-1, 0)]
		const next = patchObstacleGeometry(previous, 0, { r: 5 })

		expect(obstacleEditError(previous, next, 0, 'shape')).toBeUndefined()
	})

	it('lets a shape be removed while another entry stays broken', () => {
		const previous = [capsule(10, 5), box('a'), box('b')]
		const next = removeObstacleGeometry(previous, 2)

		expect(obstacleEditError(previous, next, undefined, 'shape')).toBeUndefined()
	})

	it('blocks an edit that breaks a valid entry', () => {
		const previous = [capsule(10, 5), capsule(5, 20)]
		const next = patchObstacleGeometry(previous, 1, { l: 5 })

		expect(obstacleEditError(previous, next, 1, 'shape')).toEqual({
			scope: 'shape',
			message: 'A capsule length must be at least twice its radius.',
		})
	})

	it('blocks a relabel that repeats a label on a later valid entry', () => {
		const previous = [box('a'), box('b')]
		const next = patchObstacleGeometry(previous, 0, { label: 'b' })

		expect(obstacleEditError(previous, next, 0, 'label')).toEqual({
			scope: 'label',
			message: 'The label "b" is used more than once.',
		})
	})

	it('blocks removing the last shape', () => {
		const previous = [box('a')]

		expect(obstacleEditError(previous, [], undefined, 'shape')).toEqual({
			scope: 'shape',
			message: 'An obstacle needs at least one geometry.',
		})
	})
})
