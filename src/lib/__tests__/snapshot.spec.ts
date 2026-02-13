import { describe, expect, it } from 'vitest'
import { createWorld } from 'koota'
import { Snapshot } from '$lib/buf/draw/v1/snapshot_pb'
import {
	Drawing,
	Shape,
	Arrows,
	Line,
	Points,
	Model,
	ModelAsset,
} from '$lib/buf/draw/v1/drawing_pb'
import { Transform, Geometry } from '$lib/buf/common/v1/common_pb'
import { Metadata } from '$lib/buf/draw/v1/metadata_pb'
import { spawnSnapshotEntities } from '../snapshot'
import { traits } from '$lib/ecs'
import { createPose } from '$lib/transform'
import { asFloat32Array } from '$lib/buffer'
import { rgbaBytesToFloat32 } from '$lib/color'

describe('spawnSnapshotEntities', () => {
	it('spawns entities for transforms', () => {
		const world = createWorld()
		const transform = new Transform({
			referenceFrame: 'arm',
			poseInObserverFrame: {
				referenceFrame: 'world',
				pose: createPose({ x: 100, y: 200, z: 300 }),
			},
		})
		const snapshot = new Snapshot({ transforms: [transform] })

		const entities = spawnSnapshotEntities(world, snapshot)

		expect(entities).toHaveLength(1)
		expect(world.query()).toHaveLength(1)
	})

	it('spawns entities for drawings', () => {
		const world = createWorld()
		const drawing = new Drawing({
			referenceFrame: 'drawing1',
			poseInObserverFrame: {
				referenceFrame: 'world',
				pose: createPose({ x: 10, y: 20, z: 30 }),
			},
			physicalObject: new Shape({
				geometryType: { case: 'points', value: new Points({ positions: new Uint8Array(12) }) },
			}),
		})
		const snapshot = new Snapshot({ drawings: [drawing] })

		const entities = spawnSnapshotEntities(world, snapshot)

		expect(entities).toHaveLength(1)
		expect(world.query()).toHaveLength(1)
	})

	it('spawns entities for both transforms and drawings', () => {
		const world = createWorld()
		const transform = new Transform({ referenceFrame: 'frame1' })
		const drawing = new Drawing({
			referenceFrame: 'drawing1',
			physicalObject: new Shape({
				geometryType: { case: 'arrows', value: new Arrows({ poses: new Uint8Array(24) }) },
			}),
		})
		const snapshot = new Snapshot({ transforms: [transform], drawings: [drawing] })

		const entities = spawnSnapshotEntities(world, snapshot)

		// 1 arrows entity + 1 frame
		expect(entities).toHaveLength(2)
		expect(world.query()).toHaveLength(2)
	})

	it('returns empty array for empty snapshot', () => {
		const world = createWorld()
		const snapshot = new Snapshot({})

		const entities = spawnSnapshotEntities(world, snapshot)

		expect(entities).toHaveLength(0)
		expect(world.query()).toHaveLength(0)
	})
})

describe('spawnTransformEntity (via spawnSnapshotEntities)', () => {
	it('spawns with name and pose traits', async () => {
		const world = createWorld()
		const name = 'gripper'
		const parent = 'arm'
		const pose = createPose({ x: 1, y: 2, z: 3, oX: 0, oY: 0, oZ: 1, theta: 45 })
		const transform = new Transform({
			referenceFrame: name,
			poseInObserverFrame: {
				referenceFrame: parent,
				pose,
			},
		})
		const snapshot = new Snapshot({ transforms: [transform] })

		spawnSnapshotEntities(world, snapshot)

		const result = world.queryFirst()
		expect(result?.get(traits.Name)).toBe(name)
		expect(result?.get(traits.Pose)).toStrictEqual(pose)
		expect(result?.get(traits.Parent)).toBe(parent)
	})

	it('spawns with geometry trait', async () => {
		const world = createWorld()
		const box = { x: 100, y: 200, z: 300 }
		const geometry = new Geometry({
			geometryType: { case: 'box', value: { dimsMm: box } },
		})
		const transform = new Transform({
			referenceFrame: 'box1',
			physicalObject: geometry,
		})
		const snapshot = new Snapshot({ transforms: [transform] })

		const [entity] = spawnSnapshotEntities(world, snapshot)

		expect(entity.get(traits.Box)).toStrictEqual(box)
	})
})

describe('spawnDrawingEntity shapes (via spawnSnapshotEntities)', () => {
	it('spawns arrows shape with Arrow trait', async () => {
		const world = createWorld()
		const posesData = new Uint8Array(24) // 1 arrow pose
		const drawing = new Drawing({
			referenceFrame: 'arrows1',
			physicalObject: new Shape({
				geometryType: { case: 'arrows', value: new Arrows({ poses: posesData }) },
			}),
		})
		const snapshot = new Snapshot({ drawings: [drawing] })

		spawnSnapshotEntities(world, snapshot)

		expect(world.query(traits.Arrows)).toHaveLength(1)
	})

	it('spawns line shape with Positions, LineWidth, PointSize traits', async () => {
		const world = createWorld()
		const positionsData = new Uint8Array(24) // 2 points
		const drawing = new Drawing({
			referenceFrame: 'line1',
			physicalObject: new Shape({
				geometryType: {
					case: 'line',
					value: new Line({ positions: positionsData, lineWidth: 3, pointSize: 5 }),
				},
			}),
		})
		const snapshot = new Snapshot({ drawings: [drawing] })

		const [entity] = spawnSnapshotEntities(world, snapshot)

		expect(entity.has(traits.LinePositions)).toBeTruthy()
		expect(entity.has(traits.LineWidth)).toBeTruthy()
		expect(entity.has(traits.PointSize)).toBeTruthy()
	})

	it('spawns points shape with BufferGeometry, PointSize traits', async () => {
		const world = createWorld()
		const positionsData = new Uint8Array(36) // 3 points
		const floats = asFloat32Array(positionsData)
		const pointSize = 8
		const drawing = new Drawing({
			referenceFrame: 'points1',
			physicalObject: new Shape({
				geometryType: {
					case: 'points',
					value: new Points({ positions: positionsData, pointSize }),
				},
			}),
		})
		const snapshot = new Snapshot({ drawings: [drawing] })

		const [entity] = spawnSnapshotEntities(world, snapshot)

		expect(entity.get(traits.BufferGeometry)?.getAttribute('position')?.array).toStrictEqual(floats)
		expect(entity.get(traits.PointSize)).toBe(pointSize * 0.001)
	})

	it('spawns with center pose if shape has center', async () => {
		const world = createWorld()
		const centerPose = createPose({ x: 10, y: 20, z: 30 })
		const drawing = new Drawing({
			referenceFrame: 'centered',
			physicalObject: new Shape({
				center: centerPose,
				geometryType: { case: 'points', value: new Points({ positions: new Uint8Array(12) }) },
			}),
		})
		const snapshot = new Snapshot({ drawings: [drawing] })

		const [entity] = spawnSnapshotEntities(world, snapshot)

		expect(entity.get(traits.Center)).toStrictEqual(centerPose)
	})

	it('spawns with Colors from metadata', async () => {
		const world = createWorld()
		const colors = new Uint8Array([255, 0, 0, 255, 0, 255, 0, 255])
		const colorsFloat = rgbaBytesToFloat32(colors)
		const drawing = new Drawing({
			referenceFrame: 'colored',
			physicalObject: new Shape({
				geometryType: { case: 'points', value: new Points({ positions: new Uint8Array(12) }) },
			}),
			metadata: new Metadata({ colors }),
		})
		const snapshot = new Snapshot({ drawings: [drawing] })

		const [entity] = spawnSnapshotEntities(world, snapshot)

		expect(entity.get(traits.Colors)).toStrictEqual(colorsFloat)
	})
})

describe('model shape handling', () => {
	it('spawns model with URL content', async () => {
		const world = createWorld()
		const url = 'https://example.com/model.gltf'
		const scale = { x: 1, y: 1, z: 1 }

		const drawing = new Drawing({
			referenceFrame: 'model1',
			physicalObject: new Shape({
				geometryType: {
					case: 'model',
					value: new Model({
						assets: [
							new ModelAsset({
								mimeType: 'model/gltf+json',
								sizeBytes: BigInt(1024),
								content: { case: 'url', value: url },
							}),
						],
						scale,
						animationName: 'idle',
					}),
				},
			}),
		})
		const snapshot = new Snapshot({ drawings: [drawing] })

		spawnSnapshotEntities(world, snapshot)

		const result = world.queryFirst(traits.GLTF)
		expect(result?.get(traits.GLTF)).toStrictEqual({ source: { url }, animationName: 'idle' })
		expect(result?.get(traits.Scale)).toStrictEqual(scale)
	})

	it('spawns model with data content', async () => {
		const world = createWorld()
		const binaryData = new Uint8Array([0x47, 0x4c, 0x54, 0x46]) // "GLTF" magic
		const drawing = new Drawing({
			referenceFrame: 'model2',
			physicalObject: new Shape({
				geometryType: {
					case: 'model',
					value: new Model({
						assets: [
							new ModelAsset({
								mimeType: 'model/gltf-binary',
								sizeBytes: BigInt(4),
								content: { case: 'data', value: binaryData },
							}),
						],
					}),
				},
			}),
		})
		const snapshot = new Snapshot({ drawings: [drawing] })

		spawnSnapshotEntities(world, snapshot)

		const result = world.queryFirst(traits.GLTF)

		expect(result?.get(traits.GLTF)).toStrictEqual({
			animationName: '',
			source: { glb: binaryData },
		})
	})

	it('spawns multiple entities for multiple model assets', async () => {
		const world = createWorld()
		const drawing = new Drawing({
			referenceFrame: 'multi-model',
			physicalObject: new Shape({
				geometryType: {
					case: 'model',
					value: new Model({
						assets: [
							new ModelAsset({
								mimeType: 'model/gltf+json',
								content: { case: 'url', value: 'https://example.com/model1.gltf' },
							}),
							new ModelAsset({
								mimeType: 'model/gltf-binary',
								content: { case: 'url', value: 'https://example.com/model2.glb' },
							}),
						],
					}),
				},
			}),
		})
		const snapshot = new Snapshot({ drawings: [drawing] })

		spawnSnapshotEntities(world, snapshot)

		const results = world.query()

		// One entity for each model asset + a reference frame entity
		expect(results).toHaveLength(3)
	})
})
