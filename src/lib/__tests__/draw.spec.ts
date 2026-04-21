import { createWorld, type World } from 'koota'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('$lib/loaders/pcd', () => ({
	parsePcdInWorker: vi.fn(() => Promise.resolve({ positions: new Float32Array(), colors: null })),
}))

import type { Metadata as MetadataType } from '$lib/metadata'

import { preAllocateBufferGeometry } from '$lib/attribute'
import { Geometry, Transform } from '$lib/buf/common/v1/common_pb'
import {
	Arrows,
	Drawing,
	Line,
	Model,
	ModelAsset,
	Points,
	Shape,
} from '$lib/buf/draw/v1/drawing_pb'
import { ColorFormat, Metadata } from '$lib/buf/draw/v1/metadata_pb'
import { STRIDE } from '$lib/buffer'
import { createChunkLoader, type EntityChunk } from '$lib/chunking'
import { traits } from '$lib/ecs'
import { getParentTrait, setParentTrait } from '$lib/ecs/traits'
import { createPose } from '$lib/transform'

import { drawDrawing, drawTransform, updateMetadata, updateTransform } from '../draw'

describe('drawTransform', () => {
	let world: World
	afterEach(() => world?.destroy())

	it('adds traits for transforms', () => {
		world = createWorld()
		const transform = new Transform({
			referenceFrame: 'box-frame',
			poseInObserverFrame: {
				referenceFrame: 'arm',
				pose: createPose({ x: 100, y: 200, z: 300 }),
			},
			physicalObject: new Geometry({
				geometryType: { case: 'box', value: { dimsMm: { x: 10, y: 20, z: 30 } } },
			}),
		})

		const entity = drawTransform(world, transform, traits.SnapshotAPI)

		expect(entity.get(traits.Name)).toBe('box-frame')
		expect(entity.get(traits.Parent)).toBe('arm')
		expect(entity.get(traits.Pose)).toStrictEqual(createPose({ x: 100, y: 200, z: 300 }))
		expect(entity.get(traits.Box)).toStrictEqual({ x: 10, y: 20, z: 30 })
		expect(entity.has(traits.ReferenceFrame)).toBe(false)
		expect(entity.has(traits.ShowAxesHelper)).toBe(false)
		expect(entity.has(traits.Removable)).toBe(true)
		expect(entity.get(traits.Parent)).toBe('arm')
		expect(entity.has(traits.SnapshotAPI)).toBe(true)
	})

	it('adds ReferenceFrame when no physicalObject', () => {
		world = createWorld()
		const transform = new Transform({ referenceFrame: 'orbit-frame' })

		const entity = drawTransform(world, transform, traits.SnapshotAPI)

		expect(entity.has(traits.ReferenceFrame)).toBe(true)
	})

	it('attaches ShowAxesHelper when metadata show_axes_helper is true', () => {
		world = createWorld()
		const transform = new Transform({
			referenceFrame: 'arm',
			metadata: {
				fields: {
					show_axes_helper: { kind: { case: 'boolValue', value: true } },
				},
			},
		})

		const entity = drawTransform(world, transform, traits.SnapshotAPI)

		expect(entity.has(traits.ShowAxesHelper)).toBe(true)
	})

	it('attaches Invisible when metadata invisible is true', () => {
		world = createWorld()
		const transform = new Transform({
			referenceFrame: 'arm',
			metadata: {
				fields: {
					invisible: { kind: { case: 'boolValue', value: true } },
				},
			},
		})

		const entity = drawTransform(world, transform, traits.SnapshotAPI)

		expect(entity.has(traits.Invisible)).toBe(true)
	})

	it('does not attach Removable when removable is false', () => {
		world = createWorld()
		const transform = new Transform({ referenceFrame: 'arm' })

		const entity = drawTransform(world, transform, traits.SnapshotAPI, { removable: false })

		expect(entity.has(traits.Removable)).toBe(false)
	})

	it('does not attach Parent trait when parent is world', () => {
		world = createWorld()
		const transform = new Transform({
			referenceFrame: 'arm',
			poseInObserverFrame: { referenceFrame: 'world', pose: createPose() },
		})

		const entity = drawTransform(world, transform, traits.SnapshotAPI)

		expect(entity.has(traits.Parent)).toBe(false)
	})

	it('adds Color trait for pointcloud with uniform color', async () => {
		world = createWorld()
		const { parsePcdInWorker } = await import('$lib/loaders/pcd')
		const positions = new Float32Array(6)
		vi.mocked(parsePcdInWorker).mockResolvedValueOnce({ id: 0, positions, colors: undefined })

		const pointCloud = new Uint8Array(0)
		const metadataColors = new Uint8Array([0, 255, 0])
		const base64Colors = btoa(String.fromCharCode(...metadataColors))
		const transform = new Transform({
			referenceFrame: 'cloud-uniform',
			physicalObject: new Geometry({
				geometryType: { case: 'pointcloud', value: { pointCloud } },
			}),
			metadata: {
				fields: {
					colors: { kind: { case: 'stringValue', value: base64Colors } },
				},
			},
		})

		const entity = drawTransform(world, transform, traits.SnapshotAPI)
		await Promise.resolve()

		expect(entity.get(traits.Color)).toStrictEqual({ r: 0, g: 1, b: 0 })
	})

	it('adds per-vertex colors to BufferGeometry for pointcloud', async () => {
		world = createWorld()
		const { parsePcdInWorker } = await import('$lib/loaders/pcd')
		const positions = new Float32Array(6)
		const pcdColors = new Uint8Array([255, 0, 0, 0, 255, 0])
		const metadataColors = new Uint8Array([0, 255, 0, 0, 0, 255])
		vi.mocked(parsePcdInWorker).mockResolvedValueOnce({ id: 0, positions, colors: pcdColors })

		const pointCloud = new Uint8Array(0)
		const base64Colors = btoa(String.fromCharCode(...metadataColors))
		const transform = new Transform({
			referenceFrame: 'cloud-vertex',
			physicalObject: new Geometry({
				geometryType: { case: 'pointcloud', value: { pointCloud } },
			}),
			metadata: {
				fields: {
					colors: { kind: { case: 'stringValue', value: base64Colors } },
				},
			},
		})

		const entity = drawTransform(world, transform, traits.SnapshotAPI)
		await Promise.resolve()

		expect(entity.has(traits.Colors)).toBe(false)
		expect(entity.get(traits.BufferGeometry)?.getAttribute('color')).toBeTruthy()
	})
})

describe('drawDrawing', () => {
	let world: World
	afterEach(() => world?.destroy())

	it('adds traits for drawing', () => {
		world = createWorld()
		const drawing = new Drawing({
			referenceFrame: 'line-1',
			poseInObserverFrame: { referenceFrame: 'base', pose: createPose({ x: 5, y: 6, z: 7 }) },
			physicalObject: new Shape({
				geometryType: {
					case: 'line',
					value: new Line({ positions: new Uint8Array(24), lineWidth: 3, dotSize: 6 }),
				},
			}),
		})

		const [entity] = drawDrawing(world, drawing, traits.SnapshotAPI, { removable: true })

		expect(entity.get(traits.Name)).toBe('line-1')
		expect(entity.get(traits.Parent)).toBe('base')
		expect(entity.has(traits.LinePositions)).toBe(true)
		expect(entity.get(traits.LineWidth)).toBe(3)
		expect(entity.get(traits.DotSize)).toBe(6)
		expect(entity.has(traits.Color)).toBe(true)
		expect(entity.has(traits.DotColors)).toBe(true)
		expect(entity.has(traits.ShowAxesHelper)).toBe(false)
		expect(entity.has(traits.Removable)).toBe(true)
		expect(entity.has(traits.SnapshotAPI)).toBe(true)
	})

	it('does not attach Removable when removable is false', () => {
		world = createWorld()
		const drawing = new Drawing({
			referenceFrame: 'pts',
			physicalObject: new Shape({
				geometryType: { case: 'points', value: new Points({ positions: new Uint8Array(12) }) },
			}),
		})

		const [entity] = drawDrawing(world, drawing, traits.SnapshotAPI, { removable: false })

		expect(entity.has(traits.Removable)).toBe(false)
	})

	it('attaches ShowAxesHelper when metadata showAxesHelper is true', () => {
		world = createWorld()
		const drawing = new Drawing({
			referenceFrame: 'line-with-axes',
			physicalObject: new Shape({
				geometryType: {
					case: 'line',
					value: new Line({ positions: new Uint8Array(24) }),
				},
			}),
			metadata: new Metadata({ showAxesHelper: true }),
		})

		const [entity] = drawDrawing(world, drawing, traits.SnapshotAPI)

		expect(entity.has(traits.ShowAxesHelper)).toBe(true)
	})

	it('attaches Invisible when metadata invisible is true', () => {
		world = createWorld()
		const drawing = new Drawing({
			referenceFrame: 'line-invisible',
			physicalObject: new Shape({
				geometryType: {
					case: 'line',
					value: new Line({ positions: new Uint8Array(24) }),
				},
			}),
			metadata: new Metadata({ invisible: true }),
		})

		const [entity] = drawDrawing(world, drawing, traits.SnapshotAPI)

		expect(entity.has(traits.Invisible)).toBe(true)
	})

	it('attaches Invisible to root entity when model metadata invisible is true', () => {
		world = createWorld()
		const drawing = new Drawing({
			referenceFrame: 'robot-invisible',
			poseInObserverFrame: { referenceFrame: 'arm', pose: createPose() },
			physicalObject: new Shape({
				geometryType: {
					case: 'model',
					value: new Model({
						assets: [
							new ModelAsset({ content: { case: 'url', value: 'https://example.com/model.gltf' } }),
						],
					}),
				},
			}),
			metadata: new Metadata({ invisible: true }),
		})

		const entities = drawDrawing(world, drawing, traits.SnapshotAPI)
		const [rootEntity] = entities

		expect(rootEntity.has(traits.Invisible)).toBe(true)
	})

	it('adds Color/Colors traits for arrows', () => {
		world = createWorld()

		const singleColorDrawing = new Drawing({
			referenceFrame: 'arrows-single',
			physicalObject: new Shape({
				geometryType: { case: 'arrows', value: new Arrows({ poses: new Uint8Array(24) }) },
			}),
			metadata: new Metadata({ colors: new Uint8Array([255, 0, 0]) }),
		})

		const multiColorDrawing = new Drawing({
			referenceFrame: 'arrows-multi',
			physicalObject: new Shape({
				geometryType: { case: 'arrows', value: new Arrows({ poses: new Uint8Array(48) }) },
			}),
			metadata: new Metadata({ colors: new Uint8Array([255, 0, 0, 0, 255, 0]) }),
		})

		const [single] = drawDrawing(world, singleColorDrawing, traits.SnapshotAPI)
		const [multi] = drawDrawing(world, multiColorDrawing, traits.SnapshotAPI)

		expect(single.get(traits.Color)).toStrictEqual({ r: 1, g: 0, b: 0 })
		expect(multi.get(traits.Colors)).toStrictEqual(new Uint8Array([255, 0, 0, 0, 255, 0]))
	})

	it('spawns a root entity and per-asset entities for model drawings, each with api trait', () => {
		world = createWorld()
		const drawing = new Drawing({
			referenceFrame: 'robot-model',
			poseInObserverFrame: { referenceFrame: 'arm', pose: createPose() },
			physicalObject: new Shape({
				geometryType: {
					case: 'model',
					value: new Model({
						scale: { x: 2, y: 2, z: 2 },
						assets: [
							new ModelAsset({ content: { case: 'url', value: 'https://example.com/model.gltf' } }),
						],
					}),
				},
			}),
		})

		const entities = drawDrawing(world, drawing, traits.SnapshotAPI)
		const [rootEntity, assetEntity] = entities

		expect(entities).toHaveLength(2)
		expect(rootEntity.has(traits.ReferenceFrame)).toBe(true)
		expect(rootEntity.get(traits.Name)).toBe('robot-model')
		expect(rootEntity.get(traits.Parent)).toBe('arm')
		expect(rootEntity.has(traits.SnapshotAPI)).toBe(true)
		expect(assetEntity.get(traits.Parent)).toBe('robot-model')
		expect(assetEntity.has(traits.SnapshotAPI)).toBe(true)
		expect(assetEntity.get(traits.Scale)).toStrictEqual({ x: 2, y: 2, z: 2 })
		expect(assetEntity.get(traits.GLTF)).toStrictEqual({
			source: { url: 'https://example.com/model.gltf' },
			animationName: '',
		})
	})

	it('adds point-specific traits for points drawings', () => {
		world = createWorld()
		const center = createPose({ x: 10, y: 20, z: 30 })
		const drawing = new Drawing({
			referenceFrame: 'points-1',
			physicalObject: new Shape({
				center,
				geometryType: {
					case: 'points',
					value: new Points({ positions: new Uint8Array(24), pointSize: 8 }),
				},
			}),
			metadata: new Metadata({ colors: new Uint8Array([0, 255, 0]) }),
		})

		const [entity] = drawDrawing(world, drawing, traits.SnapshotAPI)

		expect(entity.get(traits.Center)).toStrictEqual(center)
		expect(entity.has(traits.BufferGeometry)).toBe(true)
		expect(entity.has(traits.Points)).toBe(true)
		expect(entity.get(traits.PointSize)).toBe(8)
		expect(entity.get(traits.Color)).toStrictEqual({ r: 0, g: 1, b: 0 })
	})
})

describe('updateTransform', () => {
	let world: World
	afterEach(() => world?.destroy())

	it("removes the Parent trait when a frame's parent changes back to 'world'", () => {
		world = createWorld()

		const initial = new Transform({
			referenceFrame: 'child',
			poseInObserverFrame: { referenceFrame: 'arm', pose: createPose() },
		})
		const entity = drawTransform(world, initial, traits.SnapshotAPI)
		expect(entity.get(traits.Parent)).toBe('arm')

		updateTransform(entity, {
			...initial,
			poseInObserverFrame: { referenceFrame: 'world', pose: createPose() },
		} as Transform)

		expect(entity.has(traits.Parent)).toBe(false)
	})

	it("adds the Parent trait when a frame's parent changes from 'world' to a named frame", () => {
		world = createWorld()

		const initial = new Transform({
			referenceFrame: 'child',
			poseInObserverFrame: { referenceFrame: 'world', pose: createPose() },
		})
		const entity = drawTransform(world, initial, traits.SnapshotAPI)
		expect(entity.has(traits.Parent)).toBe(false)

		updateTransform(entity, {
			...initial,
			poseInObserverFrame: { referenceFrame: 'base', pose: createPose() },
		} as Transform)

		expect(entity.get(traits.Parent)).toBe('base')
	})
})

describe('updateMetadata', () => {
	let world: World
	afterEach(() => world?.destroy())

	it('toggles ShowAxesHelper on and off', () => {
		world = createWorld()
		const entity = world.spawn(traits.Opacity(1))

		updateMetadata(entity, { colorFormat: ColorFormat.UNSPECIFIED, showAxesHelper: true })
		expect(entity.has(traits.ShowAxesHelper)).toBe(true)

		updateMetadata(entity, { colorFormat: ColorFormat.UNSPECIFIED, showAxesHelper: false })
		expect(entity.has(traits.ShowAxesHelper)).toBe(false)
	})

	it('toggles Invisible on and off', () => {
		world = createWorld()
		const entity = world.spawn(traits.Opacity(1))

		updateMetadata(entity, { colorFormat: ColorFormat.UNSPECIFIED, invisible: true })
		expect(entity.has(traits.Invisible)).toBe(true)

		updateMetadata(entity, { colorFormat: ColorFormat.UNSPECIFIED, invisible: false })
		expect(entity.has(traits.Invisible)).toBe(false)
	})

	it('replaces a single Color with vertex Colors and vice versa', () => {
		world = createWorld()
		const entity = world.spawn(traits.Opacity(1))

		updateMetadata(entity, {
			colorFormat: ColorFormat.UNSPECIFIED,
			colors: new Uint8Array([255, 0, 0]),
		})
		expect(entity.get(traits.Color)).toStrictEqual({ r: 1, g: 0, b: 0 })
		expect(entity.has(traits.Colors)).toBe(false)

		updateMetadata(entity, {
			colorFormat: ColorFormat.UNSPECIFIED,
			colors: new Uint8Array([255, 0, 0, 0, 255, 0]),
		})
		expect(entity.has(traits.Color)).toBe(false)
		expect(entity.get(traits.Colors)).toStrictEqual(new Uint8Array([255, 0, 0, 0, 255, 0]))

		updateMetadata(entity, {
			colorFormat: ColorFormat.UNSPECIFIED,
			colors: new Uint8Array([0, 255, 0]),
		})
		expect(entity.get(traits.Color)).toStrictEqual({ r: 0, g: 1, b: 0 })
		expect(entity.has(traits.Colors)).toBe(false)
	})

	it('sets Opacity from metadata.opacities', () => {
		world = createWorld()
		const entity = world.spawn(traits.Opacity(1))

		updateMetadata(entity, {
			colorFormat: ColorFormat.UNSPECIFIED,
			opacities: new Uint8Array([128]),
		})
		expect(entity.get(traits.Opacity)).toBeCloseTo(128 / 255)

		updateMetadata(entity, { colorFormat: ColorFormat.UNSPECIFIED })
		expect(entity.get(traits.Opacity)).toBe(1)
	})
})

describe('setParentTrait', () => {
	let world: World
	afterEach(() => world?.destroy())

	it('leaves the Parent trait absent when parent is undefined', () => {
		world = createWorld()
		const entity = world.spawn()

		setParentTrait(entity, undefined)

		expect(entity.has(traits.Parent)).toBe(false)
	})

	it("removes the Parent trait when parent is 'world'", () => {
		world = createWorld()
		const entity = world.spawn(traits.Parent('arm'))

		setParentTrait(entity, 'world')

		expect(entity.has(traits.Parent)).toBe(false)
	})

	it('adds the Parent trait when transitioning from unset to a named parent', () => {
		world = createWorld()
		const entity = world.spawn()

		setParentTrait(entity, 'arm')

		expect(entity.get(traits.Parent)).toBe('arm')
	})

	it('updates the Parent trait when switching named parents', () => {
		world = createWorld()
		const entity = world.spawn(traits.Parent('arm'))

		setParentTrait(entity, 'base')

		expect(entity.get(traits.Parent)).toBe('base')
	})

	it("removes the Parent trait after a named -> 'world' round-trip (regression)", () => {
		world = createWorld()
		const entity = world.spawn()

		setParentTrait(entity, 'arm')
		expect(entity.get(traits.Parent)).toBe('arm')

		setParentTrait(entity, 'world')
		expect(entity.has(traits.Parent)).toBe(false)

		setParentTrait(entity, 'base')
		expect(entity.get(traits.Parent)).toBe('base')
	})
})

describe('getParentTrait', () => {
	let world: World
	afterEach(() => world?.destroy())

	it('returns an empty list for undefined, empty, or world parents', () => {
		expect(getParentTrait(undefined)).toEqual([])
		expect(getParentTrait('')).toEqual([])
		expect(getParentTrait('world')).toEqual([])
	})

	it('spawns without Parent trait when parent is world-like', () => {
		world = createWorld()
		const entity = world.spawn(traits.Name('child'), ...getParentTrait('world'))
		expect(entity.has(traits.Parent)).toBe(false)
	})

	it('spawns with Parent trait when parent is a named frame', () => {
		world = createWorld()
		const entity = world.spawn(traits.Name('child'), ...getParentTrait('arm'))
		expect(entity.get(traits.Parent)).toBe('arm')
	})
})

describe('createChunkLoader', () => {
	let world: World
	afterEach(() => world?.destroy())

	const emptyMetadata: MetadataType = { colorFormat: ColorFormat.UNSPECIFIED }

	it('start is a no-op when metadata has no chunks', () => {
		world = createWorld()
		const entity = world.spawn()
		const fetchChunk = vi.fn()

		const loader = createChunkLoader({
			world,
			invalidate: () => {},
			fetchChunk,
		})

		loader.start('uuid', entity, emptyMetadata)

		expect(entity.has(traits.ChunkProgress)).toBe(false)
		expect(fetchChunk).not.toHaveBeenCalled()
	})

	it('writes chunks, advances ChunkProgress, and removes it when done', async () => {
		world = createWorld()
		const total = 6
		const firstChunkEnd = 3
		const geometry = preAllocateBufferGeometry(total, STRIDE.POSITIONS, {
			colorFormat: ColorFormat.UNSPECIFIED,
		})
		const entity = world.spawn(traits.BufferGeometry(geometry))

		const chunk: EntityChunk = {
			start: firstChunkEnd,
			positions: new Float32Array([1, 2, 3, 4, 5, 6, 7, 8, 9]),
			done: true,
		}
		const fetchChunk = vi.fn(async () => chunk)

		const invalidate = vi.fn()

		const loader = createChunkLoader({ world, invalidate, fetchChunk })

		loader.start('uuid', entity, {
			colorFormat: ColorFormat.UNSPECIFIED,
			chunks: { chunkSize: firstChunkEnd, total, stride: STRIDE.POSITIONS },
		})

		expect(entity.get(traits.ChunkProgress)).toStrictEqual({
			loaded: firstChunkEnd,
			total,
		})

		await vi.waitFor(() => {
			expect(entity.has(traits.ChunkProgress)).toBe(false)
		})

		expect(fetchChunk).toHaveBeenCalledTimes(1)
		expect(fetchChunk).toHaveBeenCalledWith('uuid', firstChunkEnd, expect.any(AbortSignal))
		expect(invalidate).toHaveBeenCalled()
		expect(geometry.drawRange.count).toBe(total)
	})

	it('dispose aborts in-flight fetches and stops the loop', async () => {
		world = createWorld()
		const total = 12
		const firstChunkEnd = 4
		const geometry = preAllocateBufferGeometry(total, STRIDE.POSITIONS, {
			colorFormat: ColorFormat.UNSPECIFIED,
		})
		const entity = world.spawn(traits.BufferGeometry(geometry))

		let seenSignal: AbortSignal | undefined
		const fetchChunk = vi.fn(async (_uuid: string, _start: number, signal: AbortSignal) => {
			seenSignal = signal
			return await new Promise<EntityChunk | null>((_, reject) => {
				signal.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')))
			})
		})

		const loader = createChunkLoader({
			world,
			invalidate: () => {},
			fetchChunk,
		})

		loader.start('uuid', entity, {
			colorFormat: ColorFormat.UNSPECIFIED,
			chunks: { chunkSize: firstChunkEnd, total, stride: STRIDE.POSITIONS },
		})

		expect(entity.has(traits.ChunkProgress)).toBe(true)

		loader.dispose()

		await vi.waitFor(() => {
			expect(seenSignal?.aborted).toBe(true)
			expect(entity.has(traits.ChunkProgress)).toBe(false)
		})
	})
})
