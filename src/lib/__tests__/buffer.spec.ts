import { Color } from 'three'
import { describe, expect, it } from 'vitest'

import { asColor, asFloat32Array, asOpacity, isPerVertexColors } from '../buffer'

describe('asFloat32Array', () => {
	it('converts aligned bytes to Float32Array', () => {
		const original = new Float32Array([1, 2.5, -3])
		const bytes = new Uint8Array(original.buffer)

		const result = asFloat32Array(bytes)

		expect(result.length).toBe(3)
		expect(result[0]).toBeCloseTo(1)
		expect(result[1]).toBeCloseTo(2.5)
		expect(result[2]).toBeCloseTo(-3)
	})

	it('handles unaligned bytes by copying', () => {
		const original = new Float32Array([1, 2])
		const originalBytes = new Uint8Array(original.buffer)

		const misalignedBuffer = new ArrayBuffer(originalBytes.length + 4)
		const misalignedView = new Uint8Array(misalignedBuffer, 1, originalBytes.length)
		misalignedView.set(originalBytes)

		const result = asFloat32Array(misalignedView)

		expect(result.length).toBe(2)
		expect(result[0]).toBeCloseTo(1)
		expect(result[1]).toBeCloseTo(2)
	})

	it('creates a view over the same buffer when aligned (zero-copy)', () => {
		const original = new Float32Array([1, 2, 3])
		const bytes = new Uint8Array(original.buffer)

		const result = asFloat32Array(bytes)

		original[0] = 99
		expect(result[0]).toBeCloseTo(99)
	})
})

describe('asColor', () => {
	it('sets RGB from uint8 bytes into the target Color', () => {
		const target = new Color()
		const result = asColor(new Uint8Array([255, 128, 0]), target)

		expect(result).toBe(target)
		expect(result.r).toBeCloseTo(1)
		expect(result.g).toBeCloseTo(0.502, 2)
		expect(result.b).toBeCloseTo(0)
	})

	it('reads only r/g/b and ignores any trailing bytes', () => {
		const target = new Color()
		asColor(new Uint8Array([0, 255, 0, 128]), target)

		expect(target.r).toBeCloseTo(0)
		expect(target.g).toBeCloseTo(1)
		expect(target.b).toBeCloseTo(0)
	})

	it('reads from a byte offset into a packed two-color RGB array', () => {
		// [lineR, lineG, lineB, dotR, dotG, dotB]
		const bytes = new Uint8Array([255, 0, 0, 0, 255, 0])
		const target = new Color()

		asColor(bytes, target, 0)
		expect(target.r).toBeCloseTo(1)
		expect(target.g).toBeCloseTo(0)
		expect(target.b).toBeCloseTo(0)

		asColor(bytes, target, 3)
		expect(target.r).toBeCloseTo(0)
		expect(target.g).toBeCloseTo(1)
		expect(target.b).toBeCloseTo(0)
	})

	it('returns black when the array is too short for the given offset', () => {
		const target = new Color(1, 1, 1)
		asColor(new Uint8Array([255, 0, 0]), target, 1)

		expect(target.r).toBeCloseTo(0)
		expect(target.g).toBeCloseTo(0)
		expect(target.b).toBeCloseTo(0)
	})
})

describe('asOpacity', () => {
	it('returns normalized opacity from a single-element opacities array', () => {
		expect(asOpacity(new Uint8Array([128]))).toBeCloseTo(0.502, 2)
		expect(asOpacity(new Uint8Array([255]))).toBeCloseTo(1)
		expect(asOpacity(new Uint8Array([0]))).toBeCloseTo(0)
	})

	it('returns default fallback (1) when opacities is undefined or empty', () => {
		expect(asOpacity(undefined)).toBe(1)
		expect(asOpacity(new Uint8Array([]))).toBe(1)
	})

	it('accepts a custom fallback value', () => {
		expect(asOpacity(undefined, 0.7)).toBeCloseTo(0.7)
	})

	it('treats length-1 array as uniform opacity for any index', () => {
		// A single opacity byte always applies regardless of vertex index
		expect(asOpacity(new Uint8Array([128]), 1, 3)).toBeCloseTo(0.502, 2)
		expect(asOpacity(new Uint8Array([204]), 1, 999)).toBeCloseTo(0.8, 1)
	})

	it('reads per-vertex opacity at a specific index', () => {
		const opacities = new Uint8Array([204, 128])
		expect(asOpacity(opacities, 1, 0)).toBeCloseTo(0.8, 1) // 204/255
		expect(asOpacity(opacities, 1, 1)).toBeCloseTo(0.502, 2) // 128/255
	})

	it('returns fallback when index exceeds opacities length', () => {
		expect(asOpacity(new Uint8Array([255, 0, 0]), 0.5, 5)).toBeCloseTo(0.5)
	})
})

describe('isPerVertexColors', () => {
	it('returns true when colors length matches numPoints * 3 (RGB)', () => {
		expect(isPerVertexColors(new Uint8Array(3), 1)).toBe(true) // 1 point, RGB
		expect(isPerVertexColors(new Uint8Array(30000), 10000)).toBe(true) // 10k points, RGB
	})

	it('returns false for a single uniform color with multiple points', () => {
		expect(isPerVertexColors(new Uint8Array(3), 2)).toBe(false) // 1 RGB color, 2 points
	})

	it('returns false when color count does not align to RGB stride', () => {
		expect(isPerVertexColors(new Uint8Array(5), 1)).toBe(false)
		expect(isPerVertexColors(new Uint8Array(7), 2)).toBe(false)
	})
})
