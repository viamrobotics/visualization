import { describe, expect, it, vi } from 'vitest'
import * as Subject from '../json'

describe('json', () => {
	describe('isJSONPrefix', () => {
		it.each([
			{ input: 'snapshot', expected: true },
			{ input: 'SNAPSHOT', expected: true },
			{ input: 'Snapshot', expected: true },
			{ input: 'config', expected: false },
			{ input: 'data', expected: false },
			{ input: undefined, expected: false },
			{ input: '', expected: false },
		])('returns $expected for "$input"', ({ input, expected }) => {
			expect(Subject.isJSONPrefix(input)).toBe(expected)
		})
	})

	describe('onJSONDrop', () => {
		const mockHandlers = { addPoints: vi.fn(), addMesh: vi.fn() }

		it.each([
			{
				desc: 'ArrayBuffer result',
				result: new ArrayBuffer(8),
				expectedError: 'test.json failed to load.',
			},
			{
				desc: 'null result',
				result: null,
				expectedError: 'test.json failed to load.',
			},
			{
				desc: 'invalid JSON',
				result: 'invalid json {',
				expectedError: 'test.json failed to parse.',
			},
		])('returns $expectedError for $desc', async ({ result, expectedError }) => {
			const error = await Subject.onJSONDrop({
				name: 'test.json',
				extension: 'json',
				prefix: 'snapshot',
				result,
			})

			expect(error).toBe(expectedError)
		})

		it('returns undefined for valid snapshot JSON', async () => {
			const error = await Subject.onJSONDrop({
				name: 'test.json',
				extension: 'json',
				prefix: 'snapshot',
				result: '{"key": "value"}',
			})

			expect(error).toBeUndefined()
		})
	})
})
