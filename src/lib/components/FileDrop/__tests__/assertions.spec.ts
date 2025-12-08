import { describe, expect, it } from 'vitest'
import * as Subject from '../assertions'
import { WorldObject, type PointsGeometry, type ThreeBufferGeometry } from '$lib/WorldObject.svelte'
import { BufferGeometry } from 'three'

describe('assertions', () => {
	describe('isString', () => {
		it.each(['hello', ''])('returns true for %s', (value) => {
			expect(Subject.isString(value)).toBe(true)
		})

		it.each([null, undefined, new ArrayBuffer(8)])('returns false for %s', (value) => {
			expect(Subject.isString(value)).toBe(false)
		})
	})

	describe('isArrayBuffer', () => {
		it.each([new ArrayBuffer(8), new ArrayBuffer(16)])('returns true for %s', (value) => {
			expect(Subject.isArrayBuffer(value)).toBe(true)
		})

		it.each([null, undefined, 'hello'])('returns false for %s', (value) => {
			expect(Subject.isArrayBuffer(value)).toBe(false)
		})
	})

	describe('isPCD', () => {
		it('returns true when geometryType case is points', () => {
			const geometry: PointsGeometry = {
				center: undefined,
				geometryType: { case: 'points', value: new Float32Array([1, 2, 3]) },
			}
			const worldObject = new WorldObject<PointsGeometry>('test', undefined, undefined, geometry)

			expect(Subject.isPCD(worldObject)).toBe(true)
		})

		it('returns false when geometryType case is bufferGeometry', () => {
			const geometry: ThreeBufferGeometry = {
				center: undefined,
				geometryType: { case: 'bufferGeometry', value: new BufferGeometry() },
			}
			const worldObject = new WorldObject<ThreeBufferGeometry>(
				'test',
				undefined,
				undefined,
				geometry
			)

			expect(Subject.isPCD(worldObject)).toBe(false)
		})

		it('returns false when geometry is undefined', () => {
			const worldObject = new WorldObject<PointsGeometry>('test')

			expect(Subject.isPCD(worldObject)).toBe(false)
		})
	})

	describe('isMesh', () => {
		it('returns true when geometryType case is bufferGeometry', () => {
			const geometry: ThreeBufferGeometry = {
				center: undefined,
				geometryType: { case: 'bufferGeometry', value: new BufferGeometry() },
			}
			const worldObject = new WorldObject<ThreeBufferGeometry>(
				'test',
				undefined,
				undefined,
				geometry
			)

			expect(Subject.isMesh(worldObject)).toBe(true)
		})

		it('returns false when geometryType case is points', () => {
			const geometry: PointsGeometry = {
				center: undefined,
				geometryType: { case: 'points', value: new Float32Array([1, 2, 3]) },
			}
			const worldObject = new WorldObject<PointsGeometry>('test', undefined, undefined, geometry)

			expect(Subject.isMesh(worldObject)).toBe(false)
		})

		it('returns false when geometry is undefined', () => {
			const worldObject = new WorldObject<ThreeBufferGeometry>('test')

			expect(Subject.isMesh(worldObject)).toBe(false)
		})
	})
})
