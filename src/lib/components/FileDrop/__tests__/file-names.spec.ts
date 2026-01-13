import { describe, expect, it, vi } from 'vitest'
import { parseFileName, readFile, Extensions, Prefixes } from '../file-names'

describe('parseFileName', () => {
	describe('extension parsing', () => {
		it.each([
			{ filename: 'model.pcd', expectedExt: Extensions.PCD },
			{ filename: 'model.ply', expectedExt: Extensions.PLY },
			{ filename: 'data.json', expectedExt: Extensions.JSON },
			{ filename: 'data.pb', expectedExt: Extensions.PB },
			{ filename: 'data.pb.gz', expectedExt: Extensions.PB_GZ },
		])('parses $filename as $expectedExt extension', ({ filename, expectedExt }) => {
			const result = parseFileName(filename)
			expect(result.success).toBe(true)
			if (result.success) {
				expect(result.extension).toBe(expectedExt)
			}
		})

		it('returns error for file without extension', () => {
			const result = parseFileName('noextension')
			expect(result.success).toBe(false)
			if (!result.success) {
				expect(result.error.message).toBe('Could not determine file extension.')
			}
		})

		it('returns error for unsupported extension', () => {
			const result = parseFileName('document.txt')
			expect(result.success).toBe(false)
			if (!result.success) {
				expect(result.error.message).toContain('files are supported')
			}
		})

		it('returns error for unknown nested extension', () => {
			const result = parseFileName('data.unknown.gz')
			expect(result.success).toBe(false)
			if (!result.success) {
				expect(result.error.message).toContain('files are supported')
			}
		})
	})

	describe('prefix parsing', () => {
		it.each([
			{ filename: 'visualization_snapshot_2024.json', expectedPrefix: Prefixes.Snapshot },
			{ filename: 'visualization_snapshot_data.pb', expectedPrefix: Prefixes.Snapshot },
			{ filename: 'visualization_snapshot_compressed.pb.gz', expectedPrefix: Prefixes.Snapshot },
		])('parses $filename with snapshot prefix', ({ filename, expectedPrefix }) => {
			const result = parseFileName(filename)
			expect(result.success).toBe(true)
			if (result.success) {
				expect(result.prefix).toBe(expectedPrefix)
			}
		})

		it('returns undefined prefix for files without recognized prefix', () => {
			const result = parseFileName('model.pcd')
			expect(result.success).toBe(true)
			if (result.success) {
				expect(result.prefix).toBeUndefined()
			}
		})

		it('returns undefined prefix for files with unrecognized prefix', () => {
			const result = parseFileName('unknown_prefix.json')
			expect(result.success).toBe(true)
			if (result.success) {
				expect(result.prefix).toBeUndefined()
			}
		})
	})

	describe('prefix validation', () => {
		it.each([
			{ filename: 'visualization_snapshot_data.json', expectedExt: Extensions.JSON },
			{ filename: 'visualization_snapshot_data.pb', expectedExt: Extensions.PB },
			{ filename: 'visualization_snapshot_data.pb.gz', expectedExt: Extensions.PB_GZ },
		])('allows snapshot prefix with $expectedExt extension', ({ filename, expectedExt }) => {
			const result = parseFileName(filename)
			expect(result.success).toBe(true)
			if (result.success) {
				expect(result.extension).toBe(expectedExt)
				expect(result.prefix).toBe(Prefixes.Snapshot)
			}
		})

		it('returns error for snapshot prefix with unsupported extension', () => {
			const result = parseFileName('visualization_snapshot_data.pcd')
			expect(result.success).toBe(false)
			if (!result.success) {
				expect(result.error.message).toContain('snapshot files are supported')
			}
		})
	})

	describe('validation', () => {
		it('handles filenames with underscores but no valid prefix', () => {
			const result = parseFileName('my_model_v2.ply')
			expect(result.success).toBe(true)
			if (result.success) {
				expect(result.prefix).toBeUndefined()
				expect(result.extension).toBe(Extensions.PLY)
			}
		})

		it('handles filenames with multiple dots with valid extension', () => {
			const result = parseFileName('my.file.name.pcd')
			expect(result.success).toBe(true)
			if (result.success) {
				expect(result.extension).toBe(Extensions.PCD)
			}
		})
	})
})

describe('readFile', () => {
	const createMockReader = () => ({
		readAsText: vi.fn(),
		readAsArrayBuffer: vi.fn(),
	})

	const createMockFile = (name: string) => new File(['content'], name)

	it('reads JSON files as text', () => {
		const reader = createMockReader()
		const file = createMockFile('data.json')

		readFile(file, reader as unknown as FileReader, Extensions.JSON)

		expect(reader.readAsText).toHaveBeenCalledWith(file)
		expect(reader.readAsArrayBuffer).not.toHaveBeenCalled()
	})

	it.each([Extensions.PCD, Extensions.PLY, Extensions.PB, Extensions.PB_GZ])(
		'reads %s files as array buffer',
		(extension) => {
			const reader = createMockReader()
			const file = createMockFile(`data.${extension}`)

			readFile(file, reader as unknown as FileReader, extension)

			expect(reader.readAsArrayBuffer).toHaveBeenCalledWith(file)
			expect(reader.readAsText).not.toHaveBeenCalled()
		}
	)

	it('does nothing when extension is undefined', () => {
		const reader = createMockReader()
		const file = createMockFile('data.txt')

		readFile(file, reader as unknown as FileReader, undefined)

		expect(reader.readAsText).not.toHaveBeenCalled()
		expect(reader.readAsArrayBuffer).not.toHaveBeenCalled()
	})
})
