import { describe, expect, it, vi, beforeEach } from 'vitest'
import { plyDropper } from '../ply-dropper'
import { FileDropperError, type PlyFileDropSuccess } from '../file-dropper'
import { PLYLoader } from 'three/examples/jsm/loaders/PLYLoader.js'
import type { BufferGeometry } from 'three'

vi.mock('three/examples/jsm/loaders/PLYLoader.js', () => ({
	PLYLoader: vi.fn(),
}))

describe('plyDropper', () => {
	const mockGeometry = {
		attributes: {},
		index: null,
	} as unknown as BufferGeometry

	beforeEach(() => {
		vi.clearAllMocks()
		vi.mocked(PLYLoader).mockImplementation(
			() =>
				({
					parse: vi.fn().mockReturnValue(mockGeometry),
				}) as unknown as PLYLoader
		)
	})

	it('successfully parses valid PLY file', async () => {
		const content = new TextEncoder().encode('ply\nformat ascii 1.0\n').buffer

		const result = await plyDropper({
			name: 'model.ply',
			extension: 'ply',
			prefix: undefined,
			content,
		})

		expect(result.success).toBe(true)
		if (result.success && result.type === 'ply') {
			const plyResult = result as PlyFileDropSuccess
			expect(plyResult.type).toBe('ply')
			expect(plyResult.name).toBe('model.ply')
			expect(plyResult.ply).toBe(mockGeometry)
		}
	})

	it('returns error when content is not an ArrayBuffer', async () => {
		const result = await plyDropper({
			name: 'model.ply',
			extension: 'ply',
			prefix: undefined,
			content: 'not an array buffer',
		})

		expect(result.success).toBe(false)
		if (!result.success) {
			expect(result.error).toBeInstanceOf(FileDropperError)
			expect(result.error.message).toContain('failed to load')
		}
	})

	it('returns error when content is null', async () => {
		const result = await plyDropper({
			name: 'model.ply',
			extension: 'ply',
			prefix: undefined,
			content: null,
		})

		expect(result.success).toBe(false)
		if (!result.success) {
			expect(result.error).toBeInstanceOf(FileDropperError)
			expect(result.error.message).toContain('failed to load')
		}
	})

	it('returns error when parsing fails', async () => {
		vi.mocked(PLYLoader).mockImplementation(
			() =>
				({
					parse: vi.fn().mockImplementation(() => {
						throw new Error('Invalid PLY format')
					}),
				}) as unknown as PLYLoader
		)

		const result = await plyDropper({
			name: 'model.ply',
			extension: 'ply',
			prefix: undefined,
			content: new ArrayBuffer(8),
		})

		expect(result.success).toBe(false)
		if (!result.success) {
			expect(result.error).toBeInstanceOf(FileDropperError)
			expect(result.error.message).toContain('failed to parse')
		}
	})
})
