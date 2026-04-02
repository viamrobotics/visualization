import { Color } from 'three'
import { describe, expect, it } from 'vitest'

import { asColor, asFloat32Array, asOpacity, isVertexColors } from '../buffer'

describe('asFloat32Array', () => {
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

	it('applies a transform to each element (aligned path)', () => {
		const original = new Float32Array([1000, 2000, 3000])
		const bytes = new Uint8Array(original.buffer)
		const result = asFloat32Array(bytes, (v) => v * 0.001)

		expect(result[0]).toBeCloseTo(1)
		expect(result[1]).toBeCloseTo(2)
		expect(result[2]).toBeCloseTo(3)
	})

	it('applies a transform to each element (unaligned path)', () => {
		const original = new Float32Array([1000, 2000])
		const originalBytes = new Uint8Array(original.buffer)

		const misalignedBuffer = new ArrayBuffer(originalBytes.length + 4)
		const misalignedView = new Uint8Array(misalignedBuffer, 1, originalBytes.length)
		misalignedView.set(originalBytes)

		const result = asFloat32Array(misalignedView, (v) => v * 0.001)

		expect(result[0]).toBeCloseTo(1)
		expect(result[1]).toBeCloseTo(2)
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

describe('isVertexColors', () => {
	it('returns false for a undefined colors', () => {
		expect(isVertexColors(undefined)).toBe(false)
	})

	it('returns false for a single RGB color', () => {
		expect(isVertexColors(new Uint8Array(3))).toBe(false)
	})

	it('returns true for multi-color RGB-aligned arrays', () => {
		expect(isVertexColors(new Uint8Array(6))).toBe(true)
		expect(isVertexColors(new Uint8Array(30000))).toBe(true)
	})

	it('returns false when color count does not align to RGB stride', () => {
		expect(isVertexColors(new Uint8Array(5))).toBe(false)
		expect(isVertexColors(new Uint8Array(7))).toBe(false)
	})
})
