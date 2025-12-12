import { describe, expect, it, vi, beforeEach } from 'vitest'
import { BufferGeometry } from 'three'

vi.mock('$lib/loaders/pcd', () => ({
	parsePcdInWorker: vi.fn(),
}))

vi.mock('three/examples/jsm/loaders/PLYLoader.js', () => ({
	PLYLoader: vi.fn().mockImplementation(() => ({
		parse: vi.fn().mockReturnValue(new BufferGeometry()),
	})),
}))

import * as Subject from '../mesh'
import { parsePcdInWorker } from '$lib/loaders/pcd'
import { PLYLoader } from 'three/examples/jsm/loaders/PLYLoader.js'

describe('mesh', () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	describe('onMeshDrop', () => {
		it.each([
			{ desc: 'string result', result: 'not an arraybuffer' },
			{ desc: 'null result', result: null },
		])('returns error for $desc', async ({ result }) => {
			const spawn = vi.fn()

			const error = await Subject.onMeshDrop({
				name: 'test.pcd',
				extension: 'pcd',
				prefix: undefined,
				result,
				spawn,
			})

			expect(error).toBe('test.pcd failed to load.')
			expect(spawn).not.toHaveBeenCalled()
		})

		it('parses PCD file and calls addPoints', async () => {
			const mockPositions = new Float32Array([1, 2, 3, 4, 5, 6])
			const mockColors = new Float32Array([1, 0, 0, 0, 1, 0])
			vi.mocked(parsePcdInWorker).mockResolvedValue({
				positions: mockPositions,
				colors: mockColors,
				id: 0,
			})

			const spawn = vi.fn()

			const error = await Subject.onMeshDrop({
				name: 'test.pcd',
				extension: 'pcd',
				prefix: undefined,
				result: new ArrayBuffer(8),
				spawn,
			})

			expect(error).toBeUndefined()
			expect(parsePcdInWorker).toHaveBeenCalled()
			expect(spawn).toHaveBeenCalled()

			const [[, name], [, geometry], [, colors]] = spawn.mock.calls[0]
			expect(name).toBe('test.pcd')
			expect(geometry).toBe(mockPositions)
			expect(colors).toBe(mockColors)
		})

		it('parses PLY file and calls addMesh', async () => {
			const spawn = vi.fn()

			const error = await Subject.onMeshDrop({
				name: 'test.ply',
				extension: 'ply',
				prefix: undefined,
				result: new ArrayBuffer(8),
				spawn,
			})

			expect(error).toBeUndefined()
			expect(PLYLoader).toHaveBeenCalled()
			expect(spawn).toHaveBeenCalled()

			const [[, name], [, geometry]] = spawn.mock.calls[0]
			expect(name).toBe('test.ply')
			expect(geometry).toBeInstanceOf(BufferGeometry)
		})
	})
})
