import { describe, expect, it, vi } from 'vitest'

// Mock the pcd loader to avoid Worker instantiation in test environment
vi.mock('$lib/loaders/pcd', () => ({
	parsePcdInWorker: vi.fn(),
}))

import * as Subject from '../file-names'

describe('file-names', () => {
	describe('parseFileName', () => {
		describe('successful parsing', () => {
			it.each([
				{
					filename: 'snapshot_data.json',
					expected: { type: 'json', extension: 'json', prefix: 'snapshot', error: undefined },
				},
				{
					filename: 'snapshot_2024-01-01.json',
					expected: { type: 'json', extension: 'json', prefix: 'snapshot', error: undefined },
				},
				{
					filename: 'snapshot_data.pb',
					expected: { type: 'pb', extension: 'pb', prefix: 'snapshot', error: undefined },
				},
				{
					filename: 'snapshot_2024-01-01.pb',
					expected: { type: 'pb', extension: 'pb', prefix: 'snapshot', error: undefined },
				},
				{
					filename: 'snapshot_2024-01-01.pb.gz',
					expected: { type: 'pb', extension: 'pb.gz', prefix: 'snapshot', error: undefined },
				},
				{
					filename: 'pointcloud.pcd',
					expected: { type: 'mesh', extension: 'pcd', prefix: undefined, error: undefined },
				},
				{
					filename: 'mesh.ply',
					expected: { type: 'mesh', extension: 'ply', prefix: undefined, error: undefined },
				},
				{
					filename: 'snapshot_model.pcd',
					expected: { type: 'mesh', extension: 'pcd', prefix: undefined, error: undefined },
				},
			])('parses $filename correctly', ({ filename, expected }) => {
				expect(Subject.parseFileName(filename)).toEqual(expected)
			})
		})

		describe('error cases', () => {
			it.each([
				{
					filename: 'filename',
					expectedError: 'Could not determine file extension.',
				},
				{
					filename: 'document.txt',
					expectedError: 'files are supported',
				},
				{
					filename: 'archive.tar.bz2',
					expectedError: 'files are supported',
				},
				{
					filename: 'my.pointcloud.data.pcd',
					expectedError: 'files are supported',
				},
				{
					filename: 'data_file.json',
					expectedError: 'prefixes are supported',
				},
				{
					filename: 'config_data.pb',
					expectedError: 'prefixes are supported',
				},
				{
					filename: 'config_data.pb.gz',
					expectedError: 'prefixes are supported',
				},
			])('returns error for $filename', ({ filename, expectedError }) => {
				const result = Subject.parseFileName(filename)

				expect(result.type).toBeUndefined()
				expect(result.error).toContain(expectedError)
			})
		})
	})

	describe('readFile', () => {
		it.each([
			{ extension: 'json', method: 'readAsText' as const },
			{ extension: 'pcd', method: 'readAsArrayBuffer' as const },
			{ extension: 'ply', method: 'readAsArrayBuffer' as const },
			{ extension: 'pb', method: 'readAsArrayBuffer' as const },
			{ extension: 'pb.gz', method: 'readAsArrayBuffer' as const },
		])('reads $extension files with $method', ({ extension, method }) => {
			const file = new File([''], `test.${extension}`)
			const reader = { readAsText: vi.fn(), readAsArrayBuffer: vi.fn() } as unknown as FileReader

			Subject.readFile(file, reader, extension)

			expect(reader[method]).toHaveBeenCalledWith(file)
		})

		it('does nothing when extension is undefined', () => {
			const file = new File([''], 'test')
			const reader = { readAsText: vi.fn(), readAsArrayBuffer: vi.fn() } as unknown as FileReader

			Subject.readFile(file, reader, undefined)

			expect(reader.readAsText).not.toHaveBeenCalled()
			expect(reader.readAsArrayBuffer).not.toHaveBeenCalled()
		})
	})
})
