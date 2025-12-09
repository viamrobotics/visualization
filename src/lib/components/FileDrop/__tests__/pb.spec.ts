import { describe, expect, it, vi } from 'vitest'
import * as Subject from '../pb'

describe('pb', () => {
	describe('isPBPrefix', () => {
		it.each([
			{ input: 'snapshot', expected: true },
			{ input: 'SNAPSHOT', expected: true },
			{ input: 'Snapshot', expected: true },
			{ input: 'config', expected: false },
			{ input: 'data', expected: false },
			{ input: undefined, expected: false },
			{ input: '', expected: false },
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
		])('calls onError for $desc', ({ result, expectedError }) => {
			const onError = vi.fn()
			const onSuccess = vi.fn()

			Subject.onPBDrop('test.pb', 'pb', 'snapshot', result, onError, onSuccess)

			expect(onError).toHaveBeenCalledWith(expectedError)
		})

		it.each([
			{ filename: 'test.pb', extension: 'pb' as const },
			{ filename: 'test.pb.gz', extension: 'pb.gz' as const },
		])('calls onSuccess for valid $extension file', ({ filename, extension }) => {
			const onError = vi.fn()
			const onSuccess = vi.fn()
			const buffer = new ArrayBuffer(8)

			Subject.onPBDrop(filename, extension, 'snapshot', buffer, onError, onSuccess)

			expect(onSuccess).toHaveBeenCalledWith(`Loaded ${filename}`)
			expect(onError).not.toHaveBeenCalled()
		})
	})
})
