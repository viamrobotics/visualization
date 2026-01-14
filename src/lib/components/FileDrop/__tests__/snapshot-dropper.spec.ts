import { describe, expect, it, vi, beforeEach } from 'vitest'
import { snapshotDropper } from '../snapshot-dropper'
import { Snapshot } from '$lib/draw/v1/snapshot_pb'
import { FileDropperError, type SnapshotFileDropSuccess } from '../file-dropper'

describe('snapshotDropper', () => {
	const emptySnapshot = Snapshot.fromJson({ transforms: [], drawings: [] })

	beforeEach(() => {
		vi.restoreAllMocks()
	})

	describe('JSON decoding', () => {
		it('successfully parses valid JSON snapshot', async () => {
			vi.spyOn(Snapshot, 'fromJsonString').mockReturnValue(emptySnapshot)

			const result = await snapshotDropper({
				name: 'visualization_snapshot_test.json',
				extension: 'json',
				prefix: 'snapshot',
				content: '{"transforms":[],"drawings":[]}',
			})

			expect(result.success).toBe(true)
			if (result.success && result.type === 'snapshot') {
				const snapshotResult = result as SnapshotFileDropSuccess
				expect(snapshotResult.type).toBe('snapshot')
				expect(snapshotResult.name).toBe('visualization_snapshot_test.json')
				expect(snapshotResult.snapshot).toBe(emptySnapshot)
			}
		})

		it('returns error when JSON content is not a string', async () => {
			const result = await snapshotDropper({
				name: 'visualization_snapshot_test.json',
				extension: 'json',
				prefix: 'snapshot',
				content: new ArrayBuffer(8),
			})

			expect(result.success).toBe(false)
			if (!result.success) {
				expect(result.error).toBeInstanceOf(FileDropperError)
				expect(result.error.message).toContain('failed to load')
			}
		})

		it('returns error when JSON parsing fails', async () => {
			vi.spyOn(Snapshot, 'fromJsonString').mockImplementation(() => {
				throw new Error('Invalid JSON')
			})

			const result = await snapshotDropper({
				name: 'visualization_snapshot_test.json',
				extension: 'json',
				prefix: 'snapshot',
				content: 'invalid json',
			})

			expect(result.success).toBe(false)
			if (!result.success) {
				expect(result.error).toBeInstanceOf(FileDropperError)
				expect(result.error.message).toContain('failed to parse')
			}
		})
	})

	describe('binary (pb) decoding', () => {
		it('successfully parses valid binary snapshot', async () => {
			vi.spyOn(Snapshot, 'fromBinary').mockReturnValue(emptySnapshot)

			const result = await snapshotDropper({
				name: 'visualization_snapshot_test.pb',
				extension: 'pb',
				prefix: 'snapshot',
				content: new ArrayBuffer(8),
			})

			expect(result.success).toBe(true)
			if (result.success) {
				expect(result.type).toBe('snapshot')
				expect(result.name).toBe('visualization_snapshot_test.pb')
			}
		})

		it('returns error when binary content is not an ArrayBuffer', async () => {
			const result = await snapshotDropper({
				name: 'visualization_snapshot_test.pb',
				extension: 'pb',
				prefix: 'snapshot',
				content: 'not an array buffer',
			})

			expect(result.success).toBe(false)
			if (!result.success) {
				expect(result.error).toBeInstanceOf(FileDropperError)
				expect(result.error.message).toContain('failed to load')
			}
		})

		it('returns error when binary parsing fails', async () => {
			vi.spyOn(Snapshot, 'fromBinary').mockImplementation(() => {
				throw new Error('Invalid binary')
			})

			const result = await snapshotDropper({
				name: 'visualization_snapshot_test.pb',
				extension: 'pb',
				prefix: 'snapshot',
				content: new ArrayBuffer(8),
			})

			expect(result.success).toBe(false)
			if (!result.success) {
				expect(result.error).toBeInstanceOf(FileDropperError)
				expect(result.error.message).toContain('failed to parse')
			}
		})
	})

	describe('gzip (pb.gz) decoding', () => {
		it('returns error when gzip content is not an ArrayBuffer', async () => {
			const result = await snapshotDropper({
				name: 'visualization_snapshot_test.pb.gz',
				extension: 'pb.gz',
				prefix: 'snapshot',
				content: 'not an array buffer',
			})

			expect(result.success).toBe(false)
			if (!result.success) {
				expect(result.error).toBeInstanceOf(FileDropperError)
				expect(result.error.message).toContain('failed to load')
			}
		})

		// Note: Testing actual gzip decompression requires browser APIs (DecompressionStream)
		// which are not available in jsdom. E2E tests cover this functionality.
	})

	describe('unsupported extension', () => {
		it('returns error for unsupported extension', async () => {
			const result = await snapshotDropper({
				name: 'visualization_snapshot_test.pcd',
				extension: 'pcd',
				prefix: 'snapshot',
				content: new ArrayBuffer(8),
			})

			expect(result.success).toBe(false)
			if (!result.success) {
				expect(result.error).toBeInstanceOf(FileDropperError)
				expect(result.error.message).toContain('snapshot files are supported')
			}
		})
	})
})
