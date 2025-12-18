import { describe, expect, it } from 'vitest'
import { STRIDE, asFloat32Array, normalizeColorsRGBA } from '../buffer'

describe('asFloat32Array', () => {
	it('converts aligned bytes to Float32Array', () => {
		// Create a Float32Array and get its byte representation
		const original = new Float32Array([1.0, 2.5, -3.0])
		const bytes = new Uint8Array(original.buffer)

		const result = asFloat32Array(bytes)

		expect(result.length).toBe(3)
		expect(result[0]).toBeCloseTo(1.0)
		expect(result[1]).toBeCloseTo(2.5)
		expect(result[2]).toBeCloseTo(-3.0)
	})

	it('handles unaligned bytes by copying', () => {
		// Create a buffer with extra byte at the start to force misalignment
		const original = new Float32Array([1.0, 2.0])
		const originalBytes = new Uint8Array(original.buffer)

		// Create a larger buffer and copy at offset 1 (misaligned)
		const misalignedBuffer = new ArrayBuffer(originalBytes.length + 4)
		const misalignedView = new Uint8Array(misalignedBuffer, 1, originalBytes.length)
		misalignedView.set(originalBytes)

		const result = asFloat32Array(misalignedView)

		expect(result.length).toBe(2)
		expect(result[0]).toBeCloseTo(1.0)
		expect(result[1]).toBeCloseTo(2.0)
	})

	it('creates a view over the same buffer when aligned (zero-copy)', () => {
		const original = new Float32Array([1.0, 2.0, 3.0])
		const bytes = new Uint8Array(original.buffer)

		const result = asFloat32Array(bytes)

		// Modify original and check result is affected (same buffer)
		original[0] = 99.0
		expect(result[0]).toBeCloseTo(99.0)
	})
})

describe('normalizeColorsRGBA', () => {
	it('normalizes uint8 RGBA to 0-1 range', () => {
		const result = normalizeColorsRGBA(new Float32Array([255, 128, 0, 255]))

		expect(result.length).toBe(4)
		expect(result[0]).toBeCloseTo(1.0) // 255/255
		expect(result[1]).toBeCloseTo(0.502, 2) // 128/255
		expect(result[2]).toBeCloseTo(0.0) // 0/255
		expect(result[3]).toBeCloseTo(1.0) // 255/255
	})

	it('handles multiple colors', () => {
		const result = normalizeColorsRGBA(new Float32Array([255, 0, 0, 255, 0, 255, 0, 128]))

		expect(result.length).toBe(8)
		// First color: red
		expect(result[0]).toBeCloseTo(1.0)
		expect(result[1]).toBeCloseTo(0.0)
		expect(result[2]).toBeCloseTo(0.0)
		expect(result[3]).toBeCloseTo(1.0)
		// Second color: green with 50% alpha
		expect(result[4]).toBeCloseTo(0.0)
		expect(result[5]).toBeCloseTo(1.0)
		expect(result[6]).toBeCloseTo(0.0)
		expect(result[7]).toBeCloseTo(0.502, 2)
	})

	it('returns empty array for empty input', () => {
		const result = normalizeColorsRGBA(new Float32Array(0))
		expect(result.length).toBe(0)
	})
})
