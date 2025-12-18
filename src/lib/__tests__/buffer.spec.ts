import { describe, expect, it } from 'vitest'
import {
	STRIDE,
	asFloat32Array,
	normalizeColorsRGBA,
	normalizeColorsRGB,
	extractSingleColor,
	getElementCount,
} from '../buffer'

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
		const colors = new Uint8Array([255, 128, 0, 255])
		const result = normalizeColorsRGBA(colors)

		expect(result.length).toBe(4)
		expect(result[0]).toBeCloseTo(1.0) // 255/255
		expect(result[1]).toBeCloseTo(0.502, 2) // 128/255
		expect(result[2]).toBeCloseTo(0.0) // 0/255
		expect(result[3]).toBeCloseTo(1.0) // 255/255
	})

	it('handles multiple colors', () => {
		const colors = new Uint8Array([255, 0, 0, 255, 0, 255, 0, 128])
		const result = normalizeColorsRGBA(colors)

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
		const result = normalizeColorsRGBA(new Uint8Array(0))
		expect(result.length).toBe(0)
	})
})

describe('normalizeColorsRGB', () => {
	it('extracts RGB and drops alpha channel', () => {
		const colors = new Uint8Array([255, 128, 64, 255])
		const result = normalizeColorsRGB(colors)

		expect(result.length).toBe(3)
		expect(result[0]).toBeCloseTo(1.0) // 255/255
		expect(result[1]).toBeCloseTo(0.502, 2) // 128/255
		expect(result[2]).toBeCloseTo(0.251, 2) // 64/255
	})

	it('handles multiple colors', () => {
		const colors = new Uint8Array([255, 0, 0, 255, 0, 255, 0, 128, 0, 0, 255, 64])
		const result = normalizeColorsRGB(colors)

		expect(result.length).toBe(9)
		// First color: red
		expect(result[0]).toBeCloseTo(1.0)
		expect(result[1]).toBeCloseTo(0.0)
		expect(result[2]).toBeCloseTo(0.0)
		// Second color: green
		expect(result[3]).toBeCloseTo(0.0)
		expect(result[4]).toBeCloseTo(1.0)
		expect(result[5]).toBeCloseTo(0.0)
		// Third color: blue
		expect(result[6]).toBeCloseTo(0.0)
		expect(result[7]).toBeCloseTo(0.0)
		expect(result[8]).toBeCloseTo(1.0)
	})

	it('returns empty array for empty input', () => {
		const result = normalizeColorsRGB(new Uint8Array(0))
		expect(result.length).toBe(0)
	})

	it('ignores incomplete color at end', () => {
		// 5 bytes = 1 complete color + 1 extra byte
		const colors = new Uint8Array([255, 128, 64, 255, 100])
		const result = normalizeColorsRGB(colors)

		expect(result.length).toBe(3) // Only one complete color
	})
})

describe('extractSingleColor', () => {
	it('extracts first RGBA color as normalized object', () => {
		const colors = new Uint8Array([255, 128, 64, 200])
		const result = extractSingleColor(colors)

		expect(result.r).toBeCloseTo(1.0)
		expect(result.g).toBeCloseTo(0.502, 2)
		expect(result.b).toBeCloseTo(0.251, 2)
		expect(result.a).toBeCloseTo(0.784, 2) // 200/255
	})

	it('returns default white for insufficient bytes', () => {
		const colors = new Uint8Array([255, 128, 64]) // Only 3 bytes
		const result = extractSingleColor(colors)

		expect(result.r).toBe(1)
		expect(result.g).toBe(1)
		expect(result.b).toBe(1)
		expect(result.a).toBe(1)
	})

	it('returns default white for empty input', () => {
		const result = extractSingleColor(new Uint8Array(0))

		expect(result.r).toBe(1)
		expect(result.g).toBe(1)
		expect(result.b).toBe(1)
		expect(result.a).toBe(1)
	})

	it('ignores extra colors after first', () => {
		const colors = new Uint8Array([255, 0, 0, 255, 0, 255, 0, 128])
		const result = extractSingleColor(colors)

		// Should only extract first color (red)
		expect(result.r).toBeCloseTo(1.0)
		expect(result.g).toBeCloseTo(0.0)
		expect(result.b).toBeCloseTo(0.0)
		expect(result.a).toBeCloseTo(1.0)
	})
})

describe('getElementCount', () => {
	it('calculates arrow count from poses bytes', () => {
		// 6 floats per arrow = 24 bytes per arrow
		const bytes = new Uint8Array(24 * 3) // 3 arrows
		expect(getElementCount(bytes, STRIDE.ARROWS)).toBe(3)
	})

	it('calculates point count from positions bytes', () => {
		// 3 floats per point = 12 bytes per point
		const bytes = new Uint8Array(12 * 100) // 100 points
		expect(getElementCount(bytes, STRIDE.POSITIONS)).toBe(100)
	})

	it('calculates nurbs control point count', () => {
		// 7 floats per control point = 28 bytes per point
		const bytes = new Uint8Array(28 * 5) // 5 control points
		expect(getElementCount(bytes, STRIDE.NURBS_CONTROL_POINTS)).toBe(5)
	})

	it('returns 0 for empty input', () => {
		expect(getElementCount(new Uint8Array(0), STRIDE.POSITIONS)).toBe(0)
	})

	it('floors incomplete elements', () => {
		// 3 floats per point = 12 bytes, but we have 30 bytes (2.5 points)
		const bytes = new Uint8Array(30)
		expect(getElementCount(bytes, STRIDE.POSITIONS)).toBe(2)
	})
})
