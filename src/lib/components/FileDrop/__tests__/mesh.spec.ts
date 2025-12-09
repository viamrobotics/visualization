import { describe, expect, it, vi, beforeEach } from 'vitest'
import type { PointsGeometry, ThreeBufferGeometry, WorldObject } from '$lib/WorldObject.svelte'
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
		])('calls onError for $desc', async ({ result }) => {
			const addPoints = vi.fn()
			const addMesh = vi.fn()
			const onError = vi.fn()
			const onSuccess = vi.fn()

			await Subject.onMeshDrop('test.pcd', 'pcd', result, addPoints, addMesh, onError, onSuccess)

			expect(onError).toHaveBeenCalledWith('test.pcd failed to load.')
			expect(addPoints).not.toHaveBeenCalled()
			expect(addMesh).not.toHaveBeenCalled()
		})

		it('parses PCD file and calls addPoints', async () => {
			const mockPositions = new Float32Array([1, 2, 3, 4, 5, 6])
			const mockColors = new Float32Array([1, 0, 0, 0, 1, 0])
			vi.mocked(parsePcdInWorker).mockResolvedValue({
				positions: mockPositions,
				colors: mockColors,
				id: 0,
			})

			const addPoints = vi.fn()
			const addMesh = vi.fn()
			const onError = vi.fn()
			const onSuccess = vi.fn()

			await Subject.onMeshDrop(
				'test.pcd',
				'pcd',
				new ArrayBuffer(8),
				addPoints,
				addMesh,
				onError,
				onSuccess
			)

			expect(parsePcdInWorker).toHaveBeenCalled()
			expect(addPoints).toHaveBeenCalled()

			const worldObject = addPoints.mock.calls[0][0] as WorldObject<PointsGeometry>
			expect(worldObject.name).toBe('test.pcd')
			expect(worldObject.geometry?.geometryType.case).toBe('points')
			expect(worldObject.metadata?.colors).toBe(mockColors)
			expect(onSuccess).toHaveBeenCalledWith('Loaded test.pcd')
		})

		it('parses PLY file and calls addMesh', async () => {
			const addPoints = vi.fn()
			const addMesh = vi.fn()
			const onError = vi.fn()
			const onSuccess = vi.fn()

			await Subject.onMeshDrop(
				'test.ply',
				'ply',
				new ArrayBuffer(8),
				addPoints,
				addMesh,
				onError,
				onSuccess
			)

			expect(PLYLoader).toHaveBeenCalled()
			expect(addMesh).toHaveBeenCalled()

			const worldObject = addMesh.mock.calls[0][0] as WorldObject<ThreeBufferGeometry>
			expect(worldObject.name).toBe('test.ply')
			expect(worldObject.geometry?.geometryType.case).toBe('bufferGeometry')
			expect(onSuccess).toHaveBeenCalledWith('Loaded test.ply')
		})
	})
})
