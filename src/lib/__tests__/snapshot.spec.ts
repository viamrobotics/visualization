import { describe, expect, it, vi, beforeEach } from 'vitest'
import type { Entity, World } from 'koota'
import { Snapshot } from '$lib/draw/v1/snapshot_pb'
import {
	Drawing,
	Shape,
	Arrows,
	Line,
	Points,
	Model,
	Nurbs,
	ModelAsset,
} from '$lib/draw/v1/drawing_pb'
import { Transform, Pose, PoseInFrame, Geometry } from '$lib/common/v1/common_pb'
import { Metadata } from '$lib/draw/v1/metadata_pb'
import { spawnSnapshotEntities, destroyEntities } from '../snapshot'

// Mock the traits module
vi.mock('$lib/ecs', () => ({
	traits: {
		Name: vi.fn((v) => ({ trait: 'Name', value: v })),
		SnapshotAPI: { trait: 'SnapshotAPI' },
		Pose: vi.fn((v) => ({ trait: 'Pose', value: v })),
		Parent: vi.fn((v) => ({ trait: 'Parent', value: v })),
		Geometry: vi.fn((v) => ({ trait: 'Geometry', value: v })),
		Center: vi.fn((v) => ({ trait: 'Center', value: v })),
		Arrows: vi.fn((v) => ({ trait: 'Arrows', value: v })),
		Positions: vi.fn((v) => ({ trait: 'Positions', value: v })),
		LineWidth: vi.fn((v) => ({ trait: 'LineWidth', value: v })),
		PointSize: vi.fn((v) => ({ trait: 'PointSize', value: v })),
		ControlPoints: vi.fn((v) => ({ trait: 'ControlPoints', value: v })),
		Knots: vi.fn((v) => ({ trait: 'Knots', value: v })),
		Degree: vi.fn((v) => ({ trait: 'Degree', value: v })),
		Weights: vi.fn((v) => ({ trait: 'Weights', value: v })),
		ColorsRGBA: vi.fn((v) => ({ trait: 'ColorsRGBA', value: v })),
		MimeType: vi.fn((v) => ({ trait: 'MimeType', value: v })),
		SizeBytes: vi.fn((v) => ({ trait: 'SizeBytes', value: v })),
		URLContent: vi.fn((v) => ({ trait: 'URLContent', value: v })),
		DataContent: vi.fn((v) => ({ trait: 'DataContent', value: v })),
		Scale: vi.fn((v) => ({ trait: 'Scale', value: v })),
		AnimationName: vi.fn((v) => ({ trait: 'AnimationName', value: v })),
	},
}))

const createMockWorld = () => {
	const spawnedEntities: Entity[] = []
	return {
		spawn: vi.fn((...traits) => {
			const entity = {
				id: spawnedEntities.length,
				traits,
				destroy: vi.fn(),
			} as unknown as Entity
			spawnedEntities.push(entity)
			return entity
		}),
		spawnedEntities,
	}
}

const createPose = (x = 0, y = 0, z = 0, oX = 0, oY = 0, oZ = 1, theta = 0) =>
	new Pose({ x, y, z, oX, oY, oZ, theta })

const createPoseInFrame = (referenceFrame: string, pose?: Pose) =>
	new PoseInFrame({ referenceFrame, pose })

describe('spawnSnapshotEntities', () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	it('spawns entities for transforms', () => {
		const mockWorld = createMockWorld()
		const transform = new Transform({
			referenceFrame: 'arm',
			poseInObserverFrame: createPoseInFrame('world', createPose(100, 200, 300)),
		})
		const snapshot = new Snapshot({ transforms: [transform] })

		const entities = spawnSnapshotEntities(mockWorld as unknown as World, snapshot)

		expect(entities).toHaveLength(1)
		expect(mockWorld.spawn).toHaveBeenCalledTimes(1)
	})

	it('spawns entities for drawings', () => {
		const mockWorld = createMockWorld()
		const drawing = new Drawing({
			referenceFrame: 'drawing1',
			poseInObserverFrame: createPoseInFrame('world', createPose(10, 20, 30)),
			physicalObject: new Shape({
				geometryType: { case: 'points', value: new Points({ positions: new Uint8Array(12) }) },
			}),
		})
		const snapshot = new Snapshot({ drawings: [drawing] })

		const entities = spawnSnapshotEntities(mockWorld as unknown as World, snapshot)

		expect(entities).toHaveLength(1)
		expect(mockWorld.spawn).toHaveBeenCalledTimes(1)
	})

	it('spawns entities for both transforms and drawings', () => {
		const mockWorld = createMockWorld()
		const transform = new Transform({ referenceFrame: 'frame1' })
		const drawing = new Drawing({
			referenceFrame: 'drawing1',
			physicalObject: new Shape({
				geometryType: { case: 'arrows', value: new Arrows({ poses: new Uint8Array(24) }) },
			}),
		})
		const snapshot = new Snapshot({ transforms: [transform], drawings: [drawing] })

		const entities = spawnSnapshotEntities(mockWorld as unknown as World, snapshot)

		expect(entities).toHaveLength(2)
		expect(mockWorld.spawn).toHaveBeenCalledTimes(2)
	})

	it('returns empty array for empty snapshot', () => {
		const mockWorld = createMockWorld()
		const snapshot = new Snapshot({})

		const entities = spawnSnapshotEntities(mockWorld as unknown as World, snapshot)

		expect(entities).toHaveLength(0)
		expect(mockWorld.spawn).not.toHaveBeenCalled()
	})
})

describe('destroyEntities', () => {
	it('destroys all provided entities', () => {
		const entities = [
			{ destroy: vi.fn() },
			{ destroy: vi.fn() },
			{ destroy: vi.fn() },
		] as unknown as Entity[]

		destroyEntities(entities)

		entities.forEach((entity) => {
			expect(entity.destroy).toHaveBeenCalledTimes(1)
		})
	})

	it('handles empty array', () => {
		expect(() => destroyEntities([])).not.toThrow()
	})
})

describe('spawnTransformEntity (via spawnSnapshotEntities)', () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	it('spawns with name and pose traits', async () => {
		const { traits } = await import('$lib/ecs')
		const mockWorld = createMockWorld()
		const transform = new Transform({
			referenceFrame: 'gripper',
			poseInObserverFrame: createPoseInFrame('arm', createPose(1, 2, 3, 0, 0, 1, 45)),
		})
		const snapshot = new Snapshot({ transforms: [transform] })

		spawnSnapshotEntities(mockWorld as unknown as World, snapshot)

		expect(traits.Name).toHaveBeenCalledWith('gripper')
		expect(traits.Pose).toHaveBeenCalled()
		expect(traits.Parent).toHaveBeenCalledWith('arm')
	})

	it('spawns with geometry trait', async () => {
		const { traits } = await import('$lib/ecs')
		const mockWorld = createMockWorld()
		const geometry = new Geometry({
			geometryType: { case: 'box', value: { dimsMm: { x: 100, y: 200, z: 300 } } },
		})
		const transform = new Transform({
			referenceFrame: 'box1',
			physicalObject: geometry,
		})
		const snapshot = new Snapshot({ transforms: [transform] })

		spawnSnapshotEntities(mockWorld as unknown as World, snapshot)

		expect(traits.Geometry).toHaveBeenCalledWith(geometry)
	})
})

describe('spawnDrawingEntity shapes (via spawnSnapshotEntities)', () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	it('spawns arrows shape with Arrows trait', async () => {
		const { traits } = await import('$lib/ecs')
		const mockWorld = createMockWorld()
		const posesData = new Uint8Array(24) // 1 arrow pose
		const drawing = new Drawing({
			referenceFrame: 'arrows1',
			physicalObject: new Shape({
				geometryType: { case: 'arrows', value: new Arrows({ poses: posesData }) },
			}),
		})
		const snapshot = new Snapshot({ drawings: [drawing] })

		spawnSnapshotEntities(mockWorld as unknown as World, snapshot)

		expect(traits.Arrows).toHaveBeenCalledWith(posesData)
	})

	it('spawns line shape with Positions, LineWidth, PointSize traits', async () => {
		const { traits } = await import('$lib/ecs')
		const mockWorld = createMockWorld()
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

		spawnSnapshotEntities(mockWorld as unknown as World, snapshot)

		expect(traits.Positions).toHaveBeenCalledWith(positionsData)
		expect(traits.LineWidth).toHaveBeenCalledWith(3)
		expect(traits.PointSize).toHaveBeenCalledWith(5)
	})

	it('spawns points shape with Positions, PointSize traits', async () => {
		const { traits } = await import('$lib/ecs')
		const mockWorld = createMockWorld()
		const positionsData = new Uint8Array(36) // 3 points
		const drawing = new Drawing({
			referenceFrame: 'points1',
			physicalObject: new Shape({
				geometryType: {
					case: 'points',
					value: new Points({ positions: positionsData, pointSize: 8 }),
				},
			}),
		})
		const snapshot = new Snapshot({ drawings: [drawing] })

		spawnSnapshotEntities(mockWorld as unknown as World, snapshot)

		expect(traits.Positions).toHaveBeenCalledWith(positionsData)
		expect(traits.PointSize).toHaveBeenCalledWith(8)
	})

	it('spawns nurbs shape with ControlPoints, Knots, Degree, Weights traits', async () => {
		const { traits } = await import('$lib/ecs')
		const mockWorld = createMockWorld()
		const controlPoints = new Uint8Array(56) // 2 control points
		const knots = new Uint8Array(20) // 5 knots
		const weights = new Uint8Array(8) // 2 weights
		const drawing = new Drawing({
			referenceFrame: 'nurbs1',
			physicalObject: new Shape({
				geometryType: {
					case: 'nurbs',
					value: new Nurbs({ controlPoints, knots, degree: 3, weights }),
				},
			}),
		})
		const snapshot = new Snapshot({ drawings: [drawing] })

		spawnSnapshotEntities(mockWorld as unknown as World, snapshot)

		expect(traits.ControlPoints).toHaveBeenCalledWith(controlPoints)
		expect(traits.Knots).toHaveBeenCalledWith(knots)
		expect(traits.Degree).toHaveBeenCalledWith(3)
		expect(traits.Weights).toHaveBeenCalledWith(weights)
	})

	it('spawns with center pose if shape has center', async () => {
		const { traits } = await import('$lib/ecs')
		const mockWorld = createMockWorld()
		const centerPose = createPose(10, 20, 30)
		const drawing = new Drawing({
			referenceFrame: 'centered',
			physicalObject: new Shape({
				center: centerPose,
				geometryType: { case: 'points', value: new Points({ positions: new Uint8Array(12) }) },
			}),
		})
		const snapshot = new Snapshot({ drawings: [drawing] })

		spawnSnapshotEntities(mockWorld as unknown as World, snapshot)

		expect(traits.Center).toHaveBeenCalledWith(centerPose)
	})

	it('spawns with ColorsRGBA from metadata', async () => {
		const { traits } = await import('$lib/ecs')
		const mockWorld = createMockWorld()
		const colors = new Uint8Array([255, 0, 0, 255])
		const drawing = new Drawing({
			referenceFrame: 'colored',
			physicalObject: new Shape({
				geometryType: { case: 'points', value: new Points({ positions: new Uint8Array(12) }) },
			}),
			metadata: new Metadata({ colors }),
		})
		const snapshot = new Snapshot({ drawings: [drawing] })

		spawnSnapshotEntities(mockWorld as unknown as World, snapshot)

		expect(traits.ColorsRGBA).toHaveBeenCalledWith(colors)
	})
})

describe('model shape handling', () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	it('spawns model with URL content', async () => {
		const { traits } = await import('$lib/ecs')
		const mockWorld = createMockWorld()
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
								content: { case: 'url', value: 'https://example.com/model.gltf' },
							}),
						],
						scale: { x: 1, y: 1, z: 1 },
						animationName: 'idle',
					}),
				},
			}),
		})
		const snapshot = new Snapshot({ drawings: [drawing] })

		spawnSnapshotEntities(mockWorld as unknown as World, snapshot)

		expect(traits.MimeType).toHaveBeenCalledWith('model/gltf+json')
		expect(traits.SizeBytes).toHaveBeenCalledWith(1024)
		expect(traits.URLContent).toHaveBeenCalledWith({
			case: 'url',
			value: 'https://example.com/model.gltf',
		})
		expect(traits.Scale).toHaveBeenCalledWith({ x: 1, y: 1, z: 1 })
		expect(traits.AnimationName).toHaveBeenCalledWith('idle')
	})

	it('spawns model with data content', async () => {
		const { traits } = await import('$lib/ecs')
		const mockWorld = createMockWorld()
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

		spawnSnapshotEntities(mockWorld as unknown as World, snapshot)

		expect(traits.DataContent).toHaveBeenCalledWith({ case: 'data', value: binaryData })
	})

	it('spawns multiple entities for multiple model assets', async () => {
		const mockWorld = createMockWorld()
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

		spawnSnapshotEntities(mockWorld as unknown as World, snapshot)

		// One entity for each model asset
		expect(mockWorld.spawn).toHaveBeenCalledTimes(2)
	})
})
