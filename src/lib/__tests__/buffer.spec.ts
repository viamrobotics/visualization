import { describe, expect, it } from 'vitest'
import { Color } from 'three'
import { asFloat32Array, asColor, asOpacity } from '../buffer'

describe('asFloat32Array', () => {
	it('converts aligned bytes to Float32Array', () => {
		// Create a Float32Array and get its byte representation
		const original = new Float32Array([1, 2.5, -3])
		const bytes = new Uint8Array(original.buffer)

		const result = asFloat32Array(bytes)

		expect(result.length).toBe(3)
		expect(result[0]).toBeCloseTo(1)
		expect(result[1]).toBeCloseTo(2.5)
		expect(result[2]).toBeCloseTo(-3)
	})

	it('handles unaligned bytes by copying', () => {
		// Create a buffer with extra byte at the start to force misalignment
		const original = new Float32Array([1, 2])
		const originalBytes = new Uint8Array(original.buffer)

		// Create a larger buffer and copy at offset 1 (misaligned)
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

		// Modify original and check result is affected (same buffer)
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

	it('ignores alpha byte when present', () => {
		const target = new Color()
		asColor(new Uint8Array([0, 255, 0, 128]), target)

		expect(target.r).toBeCloseTo(0)
		expect(target.g).toBeCloseTo(1)
		expect(target.b).toBeCloseTo(0)
	})

	it('reads from a byte offset into a packed two-color array', () => {
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
	it('returns normalized alpha from index 3', () => {
		expect(asOpacity(new Uint8Array([255, 0, 0, 128]))).toBeCloseTo(0.502, 2)
		expect(asOpacity(new Uint8Array([255, 0, 0, 255]))).toBeCloseTo(1)
		expect(asOpacity(new Uint8Array([255, 0, 0, 0]))).toBeCloseTo(0)
	})

	it('returns default fallback (1) when array has fewer than 4 elements', () => {
		expect(asOpacity(new Uint8Array([255, 0, 0]))).toBe(1)
		expect(asOpacity(new Uint8Array([]))).toBe(1)
	})

	it('accepts a custom fallback value', () => {
		expect(asOpacity(new Uint8Array([255, 0, 0]), 0.7)).toBeCloseTo(0.7)
	})

	it('reads from a byte offset for alpha in a packed two-color RGBA array', () => {
		// [lineR, lineG, lineB, lineA, dotR, dotG, dotB, dotA]
		const bytes = new Uint8Array([255, 0, 0, 204, 0, 255, 0, 128])

		expect(asOpacity(bytes, 1, 3)).toBeCloseTo(0.8, 1) // lineA = 204
		expect(asOpacity(bytes, 1, 7)).toBeCloseTo(0.502, 2) // dotA = 128
	})

	it('returns fallback when array is too short for the given offset', () => {
		expect(asOpacity(new Uint8Array([255, 0, 0]), 0.5, 5)).toBeCloseTo(0.5)
	})
})
