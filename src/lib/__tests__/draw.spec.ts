import { createWorld, type World } from 'koota'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { hierarchy, relations } from '$lib/ecs'

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
import { ColorFormat, Metadata, Relationship } from '$lib/buf/draw/v1/metadata_pb'
import { STRIDE } from '$lib/buffer'
import { createChunkLoader, type EntityChunk } from '$lib/chunking'
import { traits } from '$lib/ecs'
import { Pose } from '$lib/math'

import { drawDrawing, drawTransform, updateDrawing, updateMetadata, updateTransform } from '../draw'

/** Packs a flat list of float32 pose components into the proto's little-endian byte layout. */
const packPoses = (...values: number[]): Uint8Array<ArrayBuffer> => {
	const floats = new Float32Array(values)
	return new Uint8Array(floats.buffer as ArrayBuffer)
}

/** Builds an arrows Drawing carrying the given packed poses under a stable UUID. */
const arrowsDrawing = (poses: number[], uuid = 1) =>
	new Drawing({
		referenceFrame: 'arrows-update',
		uuid: fakeUuidBytes(uuid),
		physicalObject: new Shape({
			geometryType: { case: 'arrows', value: new Arrows({ poses: packPoses(...poses) }) },
		}),
		metadata: new Metadata({ colors: new Uint8Array([0, 0, 255]) }),
	})

const fakeUuidBytes = (n: number) => {
	const bytes = new Uint8Array(16)
	bytes[15] = n
	return bytes
}

describe('drawTransform', () => {
	let world: World
	afterEach(() => world?.destroy())

	it('adds traits for transforms', () => {
		world = createWorld()
		const transform = new Transform({
			referenceFrame: 'box-frame',
			poseInObserverFrame: {
				referenceFrame: 'arm',
				pose: new Pose(100, 200, 300),
			},
			physicalObject: new Geometry({
				geometryType: { case: 'box', value: { dimsMm: { x: 10, y: 20, z: 30 } } },
			}),
		})

		const { entity } = drawTransform(world, transform, traits.SnapshotAPI)

		expect(entity.get(traits.Name)).toBe('box-frame')
		expect(hierarchy.getParentName(entity)).toBe('arm')
		// Pose translation is in mm. Matrix translation is in m, so the factor is 0.001.
		const matrix = entity.get(traits.Matrix)
		expect(matrix?.elements[12]).toBeCloseTo(0.1)
		expect(matrix?.elements[13]).toBeCloseTo(0.2)
		expect(matrix?.elements[14]).toBeCloseTo(0.3)
		expect(entity.get(traits.Box)).toStrictEqual({ x: 10, y: 20, z: 30 })
		expect(entity.has(traits.ReferenceFrame)).toBe(false)
		expect(entity.has(traits.ShowAxesHelper)).toBe(false)
		expect(entity.has(traits.Removable)).toBe(true)
		expect(entity.has(traits.SnapshotAPI)).toBe(true)
	})

	it('adds ReferenceFrame when no physicalObject', () => {
		world = createWorld()
		const transform = new Transform({ referenceFrame: 'orbit-frame' })

		const { entity } = drawTransform(world, transform, traits.SnapshotAPI)

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

		const { entity } = drawTransform(world, transform, traits.SnapshotAPI)

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

		const { entity } = drawTransform(world, transform, traits.SnapshotAPI)

		expect(entity.has(traits.Invisible)).toBe(true)
	})

	it('does not attach Removable when removable is false', () => {
		world = createWorld()
		const transform = new Transform({ referenceFrame: 'arm' })

		const { entity } = drawTransform(world, transform, traits.SnapshotAPI, { removable: false })

		expect(entity.has(traits.Removable)).toBe(false)
	})

	it('does not add a parent relation when parent is world', () => {
		world = createWorld()
		const transform = new Transform({
			referenceFrame: 'arm',
			poseInObserverFrame: { referenceFrame: 'world', pose: new Pose() },
		})

		const { entity } = drawTransform(world, transform, traits.SnapshotAPI)

		expect(hierarchy.getParentName(entity)).toBeUndefined()
		expect(entity.has(traits.Orphan)).toBe(false)
	})

	it('adds Color trait for pointcloud with uniform color', async () => {
		world = createWorld()
		const { parsePcdInWorker } = await import('$lib/loaders/pcd')
		const positions = new Float32Array(6)
		vi.mocked(parsePcdInWorker).mockResolvedValueOnce({
			id: 0,
			positions,
			colors: undefined,
			bounds: undefined,
			boundsTree: undefined,
			shuffled: 0,
		})

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

		const { entity } = drawTransform(world, transform, traits.SnapshotAPI)
		await Promise.resolve()

		expect(entity.get(traits.Color)).toStrictEqual({ r: 0, g: 1, b: 0 })
	})

	it('adds per-vertex colors to BufferGeometry for pointcloud', async () => {
		world = createWorld()
		const { parsePcdInWorker } = await import('$lib/loaders/pcd')
		const positions = new Float32Array(6)
		const pcdColors = new Uint8Array([255, 0, 0, 0, 255, 0])
		const metadataColors = new Uint8Array([0, 255, 0, 0, 0, 255])
		vi.mocked(parsePcdInWorker).mockResolvedValueOnce({
			id: 0,
			positions,
			colors: pcdColors,
			bounds: undefined,
			boundsTree: undefined,
			shuffled: 0,
		})

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

		const { entity } = drawTransform(world, transform, traits.SnapshotAPI)
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
			poseInObserverFrame: { referenceFrame: 'base', pose: new Pose(5, 6, 7) },
			physicalObject: new Shape({
				geometryType: {
					case: 'line',
					value: new Line({ positions: new Uint8Array(24), lineWidth: 3, dotSize: 6 }),
				},
			}),
		})

		const { entity } = drawDrawing(world, drawing, traits.SnapshotAPI, { removable: true })

		expect(entity.get(traits.Name)).toBe('line-1')
		expect(hierarchy.getParentName(entity)).toBe('base')
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

		const { entity } = drawDrawing(world, drawing, traits.SnapshotAPI, { removable: false })

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

		const { entity } = drawDrawing(world, drawing, traits.SnapshotAPI)

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

		const { entity } = drawDrawing(world, drawing, traits.SnapshotAPI)

		expect(entity.has(traits.Invisible)).toBe(true)
	})

	it('attaches Invisible to root entity when model metadata invisible is true', () => {
		world = createWorld()
		const drawing = new Drawing({
			referenceFrame: 'robot-invisible',
			poseInObserverFrame: { referenceFrame: 'arm', pose: new Pose() },
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

		const { entity: rootEntity } = drawDrawing(world, drawing, traits.SnapshotAPI)
		const [assetEntity] = world.query(relations.ChildOf(rootEntity))

		expect(rootEntity.has(traits.Invisible)).toBe(true)
		expect(assetEntity.has(traits.Invisible)).toBe(true)
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

		const { entity: single } = drawDrawing(world, singleColorDrawing, traits.SnapshotAPI)
		const { entity: multi } = drawDrawing(world, multiColorDrawing, traits.SnapshotAPI)

		expect(single.get(traits.Color)).toStrictEqual({ r: 1, g: 0, b: 0 })
		expect(multi.get(traits.Colors)).toStrictEqual(new Uint8Array([255, 0, 0, 0, 255, 0]))
	})

	it('spawns a root entity and per-asset entities for model drawings, each with api trait', () => {
		world = createWorld()
		const drawing = new Drawing({
			referenceFrame: 'robot-model',
			poseInObserverFrame: { referenceFrame: 'arm', pose: new Pose() },
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

		const { entity: rootEntity } = drawDrawing(world, drawing, traits.SnapshotAPI)
		const [assetEntity] = world.query(relations.ChildOf(rootEntity))

		expect(rootEntity.has(traits.ReferenceFrame)).toBe(true)
		expect(rootEntity.get(traits.Name)).toBe('robot-model')
		expect(hierarchy.getParentName(rootEntity)).toBe('arm')
		expect(rootEntity.has(traits.SnapshotAPI)).toBe(true)
		expect(hierarchy.getParentName(assetEntity)).toBe('robot-model')
		expect(assetEntity.targetFor(relations.ChildOf)).toBe(rootEntity)
		expect(assetEntity.has(traits.SnapshotAPI)).toBe(true)
		const assetMatrix = assetEntity.get(traits.Matrix)
		expect(assetMatrix?.elements[0]).toBeCloseTo(2)
		expect(assetMatrix?.elements[5]).toBeCloseTo(2)
		expect(assetMatrix?.elements[10]).toBeCloseTo(2)
		expect(assetEntity.get(traits.GLTF)).toStrictEqual({
			source: { url: 'https://example.com/model.gltf' },
			animationName: '',
		})
	})

	it('adds point-specific traits for points drawings', () => {
		world = createWorld()
		const center = new Pose(10, 20, 30)
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

		const { entity } = drawDrawing(world, drawing, traits.SnapshotAPI)

		// Center holds the decoded wire object, not a Pose instance — compare fields only.
		expect(entity.get(traits.Center)).toEqual(center)
		expect(entity.has(traits.BufferGeometry)).toBe(true)
		expect(entity.has(traits.Points)).toBe(true)
		expect(entity.get(traits.PointSize)).toBe(8)
		expect(entity.get(traits.Color)).toStrictEqual({ r: 0, g: 1, b: 0 })
	})
})

describe('updateTransform', () => {
	let world: World
	afterEach(() => world?.destroy())

	it("clears the parent relation when a frame's parent changes back to 'world'", () => {
		world = createWorld()

		const initial = new Transform({
			referenceFrame: 'child',
			poseInObserverFrame: { referenceFrame: 'arm', pose: {} },
		})
		const { entity } = drawTransform(world, initial, traits.SnapshotAPI)
		expect(hierarchy.getParentName(entity)).toBe('arm')

		updateTransform(entity, {
			...initial,
			poseInObserverFrame: { referenceFrame: 'world', pose: {} },
		} as Transform)

		expect(hierarchy.getParentName(entity)).toBeUndefined()
	})

	it("attaches a parent when a frame's parent changes from 'world' to a named frame", () => {
		world = createWorld()

		const initial = new Transform({
			referenceFrame: 'child',
			poseInObserverFrame: { referenceFrame: 'world', pose: new Pose() },
		})
		const { entity } = drawTransform(world, initial, traits.SnapshotAPI)
		expect(hierarchy.getParentName(entity)).toBeUndefined()

		updateTransform(entity, {
			...initial,
			poseInObserverFrame: { referenceFrame: 'base', pose: {} },
		} as Transform)

		expect(hierarchy.getParentName(entity)).toBe('base')
	})
})

describe('updateDrawing arrows', () => {
	let world: World
	afterEach(() => world?.destroy())

	it('rewrites the Positions buffer to the new poses when re-drawn under the same UUID', () => {
		world = createWorld()

		const { entity } = drawDrawing(world, arrowsDrawing([100, 0, 0, 0, 0, 1]), traits.SnapshotAPI)
		expect([...(entity.get(traits.Positions) ?? [])]).toEqual([100, 0, 0, 0, 0, 1])

		updateDrawing(world, entity, arrowsDrawing([500, 200, 0, 1, 0, 0]))

		expect([...(entity.get(traits.Positions) ?? [])]).toEqual([500, 200, 0, 1, 0, 0])
	})

	it('keeps arrow poses in raw millimeters on update (mm->m conversion happens downstream, not twice)', () => {
		world = createWorld()

		// The ADD path stores poses verbatim in mm. The shader, raycast and hover scale by 0.001.
		const { entity } = drawDrawing(world, arrowsDrawing([100, 0, 0, 0, 0, 1]), traits.SnapshotAPI)
		expect(entity.get(traits.Positions)?.[0]).toBe(100)

		// The UPDATE path must not re-apply inMeters — that double-converts and collapses
		// arrows toward the origin (0.5mm instead of 500mm) once the update actually re-renders.
		updateDrawing(world, entity, arrowsDrawing([500, 0, 0, 0, 0, 1]))
		expect(entity.get(traits.Positions)?.[0]).toBe(500)
	})

	it('notifies renderers watching Positions so the arrows re-render in place', () => {
		world = createWorld()

		const { entity } = drawDrawing(world, arrowsDrawing([100, 0, 0, 0, 0, 1]), traits.SnapshotAPI)

		let notified: Float32Array | undefined
		const unsubscribe = world.onChange(traits.Positions, (changed) => {
			notified = changed.get(traits.Positions)
		})

		updateDrawing(world, entity, arrowsDrawing([500, 0, 0, 0, 0, 1]))
		unsubscribe()

		expect(notified?.[0]).toBe(500)
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

describe('Uuid trait', () => {
	let world: World
	afterEach(() => world?.destroy())

	it('attaches Uuid trait to drawTransform when uuid bytes are present', () => {
		world = createWorld()
		const transform = new Transform({
			referenceFrame: 'with-uuid',
			uuid: fakeUuidBytes(1),
		})

		const { entity } = drawTransform(world, transform, traits.SnapshotAPI)

		expect(entity.has(traits.UUID)).toBe(true)
		expect(entity.get(traits.UUID)).toBeTruthy()
	})

	it('does not attach Uuid trait when uuid bytes are empty', () => {
		world = createWorld()
		const transform = new Transform({ referenceFrame: 'no-uuid' })

		const { entity } = drawTransform(world, transform, traits.SnapshotAPI)

		expect(entity.has(traits.UUID)).toBe(false)
	})

	it('attaches Uuid trait to drawDrawing when uuid bytes are present', () => {
		world = createWorld()
		const drawing = new Drawing({
			referenceFrame: 'drawing-with-uuid',
			uuid: fakeUuidBytes(2),
			physicalObject: new Shape({
				geometryType: {
					case: 'line',
					value: new Line({ positions: new Uint8Array(24) }),
				},
			}),
		})

		const { entity } = drawDrawing(world, drawing, traits.SnapshotAPI)

		expect(entity.has(traits.UUID)).toBe(true)
		expect(entity.get(traits.UUID)).toBeTruthy()
	})
})

describe('drawDrawing with metadata relationships', () => {
	let world: World
	afterEach(() => world?.destroy())

	it('stores relationships in metadata for drawings', () => {
		world = createWorld()
		const targetUuid = fakeUuidBytes(10)
		const drawing = new Drawing({
			referenceFrame: 'source-drawing',
			uuid: fakeUuidBytes(1),
			physicalObject: new Shape({
				geometryType: {
					case: 'line',
					value: new Line({ positions: new Uint8Array(24) }),
				},
			}),
			metadata: new Metadata({
				relationships: [new Relationship({ targetUuid, type: 'HoverLink' })],
			}),
		})

		const { entity } = drawDrawing(world, drawing, traits.SnapshotAPI)

		expect(entity.has(traits.UUID)).toBe(true)
	})
})

describe('drawTransform with struct relationships', () => {
	let world: World
	afterEach(() => world?.destroy())

	it('parses relationships from transform struct metadata', () => {
		world = createWorld()
		const targetUuid = fakeUuidBytes(20)
		const base64TargetUuid = btoa(String.fromCharCode(...targetUuid))

		const transform = new Transform({
			referenceFrame: 'source-transform',
			uuid: fakeUuidBytes(1),
			metadata: {
				fields: {
					relationships: {
						kind: {
							case: 'listValue',
							value: {
								values: [
									{
										kind: {
											case: 'structValue',
											value: {
												fields: {
													target_uuid: {
														kind: { case: 'stringValue', value: base64TargetUuid },
													},
													type: {
														kind: { case: 'stringValue', value: 'HoverLink' },
													},
													index_mapping: {
														kind: { case: 'stringValue', value: 'index * 2' },
													},
												},
											},
										},
									},
								],
							},
						},
					},
				},
			},
		})

		const { entity } = drawTransform(world, transform, traits.SnapshotAPI)

		expect(entity.has(traits.UUID)).toBe(true)
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
