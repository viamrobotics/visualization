import { describe, expect, it, vi, beforeEach } from 'vitest'
import { pcdDropper } from '../pcd-dropper'
import { FileDropperError, type PointcloudFileDropSuccess } from '../file-dropper'
import { parsePcdInWorker } from '$lib/loaders/pcd'

vi.mock('$lib/loaders/pcd', () => ({
	parsePcdInWorker: vi.fn(),
}))

describe('pcdDropper', () => {
	const mockPcdResult = {
		id: 1,
		positions: new Float32Array([0, 0, 0, 1, 1, 1]),
		colors: new Uint8Array([255, 0, 0, 0, 255, 0]),
	}

	beforeEach(() => {
		vi.clearAllMocks()
	})

	it('successfully parses valid PCD file', async () => {
		vi.mocked(parsePcdInWorker).mockResolvedValue(mockPcdResult)

		const content = new ArrayBuffer(8)
		const result = await pcdDropper({
			name: 'model.pcd',
			extension: 'pcd',
			prefix: undefined,
			content,
		})

		expect(result.success).toBe(true)
		if (result.success && result.type === 'pcd') {
			const pcdResult = result as PointcloudFileDropSuccess
			expect(pcdResult.type).toBe('pcd')
			expect(pcdResult.name).toBe('model.pcd')
			expect(pcdResult.pcd).toBe(mockPcdResult)
		}

		expect(parsePcdInWorker).toHaveBeenCalledWith(expect.any(Uint8Array))
	})

	it('returns error when content is not an ArrayBuffer', async () => {
		const result = await pcdDropper({
			name: 'model.pcd',
			extension: 'pcd',
			prefix: undefined,
			content: 'not an array buffer',
		})

		expect(result.success).toBe(false)
		if (!result.success) {
			expect(result.error).toBeInstanceOf(FileDropperError)
			expect(result.error.message).toContain('failed to load')
		}

		expect(parsePcdInWorker).not.toHaveBeenCalled()
	})

	it('returns error when content is null', async () => {
		const result = await pcdDropper({
			name: 'model.pcd',
			extension: 'pcd',
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
		vi.mocked(parsePcdInWorker).mockRejectedValue(new Error('Parse error'))

		const result = await pcdDropper({
			name: 'model.pcd',
			extension: 'pcd',
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
