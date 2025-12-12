import { describe, expect, it, vi } from 'vitest'
import * as Subject from '../pb'

describe('pb', () => {
	describe('isPBPrefix', () => {
		it.each([
			{ input: 'snapshot', expected: true },
			{ input: 'SNAPSHOT', expected: true },
			{ input: 'Snapshot', expected: true },
			{ input: 'somethingelse', expected: false },
			{ input: '', expected: false },
			{ input: undefined, expected: false },
		])('returns $expected for "$input"', ({ input, expected }) => {
			expect(Subject.isPBPrefix(input)).toBe(expected)
		})
	})

	describe('onPBDrop', () => {
		it.each([
			{
				desc: 'string result',
				result: 'not an arraybuffer',
				expectedError: 'test.pb failed to load.',
			},
			{
				desc: 'null result',
				result: null,
				expectedError: 'test.pb failed to load.',
			},
		])('returns error for $desc', async ({ result, expectedError }) => {
			const error = await Subject.onPBDrop({
				name: 'test.pb',
				extension: 'pb',
				prefix: 'snapshot',
				result,
				spawn: vi.fn(),
			})

			expect(error).toBe(expectedError)
		})

		it.each([
			{ filename: 'test.pb', extension: 'pb' as const },
			{ filename: 'test.pb.gz', extension: 'pb.gz' as const },
		])('returns undefined for valid $extension file', async ({ filename, extension }) => {
			const error = await Subject.onPBDrop({
				name: filename,
				extension,
				prefix: 'snapshot',
				result: new ArrayBuffer(8),
				spawn: vi.fn(),
			})

			expect(error).toBeUndefined()
		})
	})
})
