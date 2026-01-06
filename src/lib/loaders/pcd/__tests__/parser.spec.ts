import { describe, expect, it } from 'vitest'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { parseHeader, parsePcd } from '../parser'
import { createRandomPcdBinary } from '$lib/test/createRandomPcdBinary'

const fixturesDir = path.resolve(process.cwd(), 'client/data')

const loadFixture = (filename: string): ArrayBuffer => {
	const filePath = path.join(fixturesDir, filename)
	const buffer = fs.readFileSync(filePath)
	return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength)
}

describe('parseHeader', () => {
	it('parses ASCII PCD header correctly', () => {
		const data = loadFixture('simple.pcd')
		const header = parseHeader(data)

		expect(header.version).toBeCloseTo(0.7, 1)
		expect(header.fields).toEqual(['x', 'y', 'z', 'rgb'])
		expect(header.size).toEqual([4, 4, 4, 4])
		expect(header.type).toEqual(['F', 'F', 'F', 'F'])
		expect(header.count).toEqual([1, 1, 1, 1])
		expect(header.width).toBe(213)
		expect(header.height).toBe(1)
		expect(header.points).toBe(213)
		expect(header.data).toBe('ascii')
	})

	it('parses binary PCD header correctly', () => {
		const data = loadFixture('octagon.pcd')
		const header = parseHeader(data)

		expect(header.version).toBeCloseTo(0.7, 1)
		expect(header.fields).toEqual(['x', 'y', 'z', 'rgb'])
		expect(header.size).toEqual([4, 4, 4, 4])
		expect(header.type).toEqual(['F', 'F', 'F', 'I'])
		expect(header.count).toEqual([1, 1, 1, 1])
		expect(header.width).toBe(628)
		expect(header.height).toBe(1)
		expect(header.points).toBe(628)
		expect(header.data).toBe('binary')
	})

	it('calculates correct offsets for ASCII format', () => {
		const data = loadFixture('simple.pcd')
		const header = parseHeader(data)

		// ASCII format uses field index as offset
		expect(header.offset).toEqual({
			x: 0,
			y: 1,
			z: 2,
			rgb: 3,
		})
	})

	it('calculates correct offsets for binary format', () => {
		const data = loadFixture('octagon.pcd')
		const header = parseHeader(data)

		// Binary format uses byte offsets
		expect(header.offset).toEqual({
			x: 0,
			y: 4,
			z: 8,
			rgb: 12,
		})
		expect(header.rowSize).toBe(16)
	})

	it('handles missing COUNT field by defaulting to 1', () => {
		// Create a PCD without explicit COUNT field
		const header = `VERSION 0.7
FIELDS x y z
SIZE 4 4 4
TYPE F F F
WIDTH 1
HEIGHT 1
POINTS 1
DATA ascii
1.0 2.0 3.0`
		const data = new TextEncoder().encode(header)
		const parsedHeader = parseHeader(data.buffer as ArrayBuffer)

		// COUNT defaults to 1 for each field
		expect(parsedHeader.count).toEqual([1, 1, 1])
	})

	it('throws error for invalid PCD without DATA field', () => {
		const invalidPcd = new TextEncoder().encode('VERSION 0.7\nFIELDS x y z\n')
		expect(() => parseHeader(invalidPcd.buffer as ArrayBuffer)).toThrow('DATA field not found')
	})
})

describe('parsePcd', () => {
	describe('ASCII format', () => {
		it('parses positions from ASCII PCD', async () => {
			const data = loadFixture('simple.pcd')
			const result = await parsePcd(data)

			expect(result.positions).toBeInstanceOf(Float32Array)
			expect(result.positions.length).toBe(213 * 3)

			// Check first point (from simple.pcd: 0.93773 0.33763 0)
			expect(result.positions[0]).toBeCloseTo(0.93773, 4)
			expect(result.positions[1]).toBeCloseTo(0.33763, 4)
			expect(result.positions[2]).toBeCloseTo(0, 4)
		})

		it('parses colors from ASCII PCD', async () => {
			const data = loadFixture('simple.pcd')
			const result = await parsePcd(data)

			expect(result.colors).toBeInstanceOf(Float32Array)
			expect(result.colors!.length).toBe(213 * 3)

			// Colors are in 0-1 range (sRGB values)
			// All points in simple.pcd have the same rgb value (4.2108e+06 or 4808000)
			// which encodes to roughly (64, 64, 64) in RGB
			expect(result.colors![0]).toBeGreaterThan(0)
			expect(result.colors![1]).toBeGreaterThan(0)
			expect(result.colors![2]).toBeGreaterThan(0)
		})

		it('returns null for missing optional fields', async () => {
			// Create PCD without rgb field
			const header = `# .PCD v0.7
VERSION 0.7
FIELDS x y z
SIZE 4 4 4
TYPE F F F
COUNT 1 1 1
WIDTH 2
HEIGHT 1
POINTS 2
DATA ascii
1.0 2.0 3.0
4.0 5.0 6.0`
			const data = new TextEncoder().encode(header)
			const result = await parsePcd(data.buffer as ArrayBuffer)

			expect(result.colors).toBeNull()
			expect(result.normals).toBeNull()
			expect(result.intensity).toBeNull()
			expect(result.labels).toBeNull()
		})

		it('parses generated ASCII PCD correctly', async () => {
			const numPoints = 100
			const data = createRandomPcdBinary(numPoints, 1, 'xyz')
			const result = await parsePcd(data.buffer as ArrayBuffer)

			expect(result.positions.length).toBe(numPoints * 3)
			expect(result.colors).not.toBeNull()
			expect(result.colors!.length).toBe(numPoints * 3)
		})
	})

	describe('Binary format', () => {
		it('parses positions from binary PCD', async () => {
			const data = loadFixture('octagon.pcd')
			const result = await parsePcd(data)

			expect(result.positions).toBeInstanceOf(Float32Array)
			expect(result.positions.length).toBe(628 * 3)

			// First point coordinates (visible in hex dump as floats)
			// The values are valid 3D coordinates
			expect(Number.isFinite(result.positions[0])).toBe(true)
			expect(Number.isFinite(result.positions[1])).toBe(true)
			expect(Number.isFinite(result.positions[2])).toBe(true)
		})

		it('parses colors from binary PCD', async () => {
			const data = loadFixture('octagon.pcd')
			const result = await parsePcd(data)

			expect(result.colors).toBeInstanceOf(Float32Array)
			expect(result.colors!.length).toBe(628 * 3)

			// Colors should be valid (0-1 range)
			for (let i = 0; i < Math.min(30, result.colors!.length); i++) {
				expect(result.colors![i]).toBeGreaterThanOrEqual(0)
				expect(result.colors![i]).toBeLessThanOrEqual(1)
			}
		})

		it('parses larger binary PCD correctly', async () => {
			const data = loadFixture('Zaghetto.pcd')
			const result = await parsePcd(data)

			expect(result.positions).toBeInstanceOf(Float32Array)
			expect(result.positions.length).toBe(59750 * 3)

			// Verify all positions are valid numbers
			let hasNaN = false
			for (let i = 0; i < result.positions.length; i++) {
				if (!Number.isFinite(result.positions[i])) {
					hasNaN = true
					break
				}
			}
			expect(hasNaN).toBe(false)
		})
	})
})
