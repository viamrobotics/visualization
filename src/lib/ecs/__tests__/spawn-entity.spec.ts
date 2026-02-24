import { afterEach, describe, expect, it, vi } from 'vitest'
import { createWorld, type World } from 'koota'

vi.mock('$lib/loaders/pcd', () => ({
	parsePcdInWorker: vi.fn(() => Promise.resolve({ positions: new Float32Array(), colors: null })),
}))
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
import { traits } from '$lib/ecs'
import { createPose } from '$lib/transform'
import { asFloat32Array } from '$lib/buffer'
import { spawnTransformEntity, spawnDrawingEntities } from '../spawn-entity'

describe('spawnTransformEntity', () => {
	let world: World
	afterEach(() => world?.destroy())

	it('spawns entity with name and pose traits', () => {
		world = createWorld()
		const name = 'gripper'
		const pose = createPose({ x: 1, y: 2, z: 3, oX: 0, oY: 0, oZ: 1, theta: 45 })
		const transform = new Transform({
			referenceFrame: name,
			poseInObserverFrame: { referenceFrame: 'world', pose },
		})

		const entity = spawnTransformEntity(world, transform, traits.SnapshotAPI)

		expect(entity.get(traits.Name)).toBe(name)
		expect(entity.get(traits.Pose)).toStrictEqual(pose)
	})

	it('attaches the provided api trait', () => {
		world = createWorld()
		const transform = new Transform({ referenceFrame: 'arm' })

		const entity = spawnTransformEntity(world, transform, traits.SnapshotAPI)

		expect(entity.has(traits.SnapshotAPI)).toBe(true)
		expect(entity.has(traits.WorldStateStoreAPI)).toBe(false)
	})

	it('attaches a different api trait when specified', () => {
		world = createWorld()
		const transform = new Transform({ referenceFrame: 'arm' })

		const entity = spawnTransformEntity(world, transform, traits.WorldStateStoreAPI)

		expect(entity.has(traits.WorldStateStoreAPI)).toBe(true)
		expect(entity.has(traits.SnapshotAPI)).toBe(false)
	})

	it('always attaches ShowAxesHelper', () => {
		world = createWorld()
		const transform = new Transform({ referenceFrame: 'arm' })

		const entity = spawnTransformEntity(world, transform, traits.SnapshotAPI)

		expect(entity.has(traits.ShowAxesHelper)).toBe(true)
	})

	it('attaches Removable when removable option is true (default)', () => {
		world = createWorld()
		const transform = new Transform({ referenceFrame: 'arm' })

		const entity = spawnTransformEntity(world, transform, traits.SnapshotAPI)

		expect(entity.has(traits.Removable)).toBe(true)
	})

	it('does not attach Removable when removable option is false', () => {
		world = createWorld()
		const transform = new Transform({ referenceFrame: 'arm' })

		const entity = spawnTransformEntity(world, transform, traits.SnapshotAPI, {
			removable: false,
		})

		expect(entity.has(traits.Removable)).toBe(false)
	})

	it('attaches Parent trait when reference frame is not world', () => {
		world = createWorld()
		const transform = new Transform({
			referenceFrame: 'gripper',
			poseInObserverFrame: { referenceFrame: 'arm', pose: createPose() },
		})

		const entity = spawnTransformEntity(world, transform, traits.SnapshotAPI)

		expect(entity.get(traits.Parent)).toBe('arm')
	})

	it('does not attach Parent trait when reference frame is world', () => {
		world = createWorld()
		const transform = new Transform({
			referenceFrame: 'arm',
			poseInObserverFrame: { referenceFrame: 'world', pose: createPose() },
		})

		const entity = spawnTransformEntity(world, transform, traits.SnapshotAPI)

		expect(entity.has(traits.Parent)).toBe(false)
	})

	it('does not attach Parent trait when reference frame is absent', () => {
		world = createWorld()
		const transform = new Transform({ referenceFrame: 'arm' })

		const entity = spawnTransformEntity(world, transform, traits.SnapshotAPI)

		expect(entity.has(traits.Parent)).toBe(false)
	})

	it('spawns with Box trait from box geometry', () => {
		world = createWorld()
		const box = { x: 100, y: 200, z: 300 }
		const geometry = new Geometry({
			geometryType: { case: 'box', value: { dimsMm: box } },
		})
		const transform = new Transform({ referenceFrame: 'box1', physicalObject: geometry })

		const entity = spawnTransformEntity(world, transform, traits.SnapshotAPI)

		expect(entity.get(traits.Box)).toStrictEqual(box)
	})

	it('spawns with Capsule trait from capsule geometry', () => {
		world = createWorld()
		const geometry = new Geometry({
			geometryType: { case: 'capsule', value: { radiusMm: 50, lengthMm: 200 } },
		})
		const transform = new Transform({ referenceFrame: 'capsule1', physicalObject: geometry })

		const entity = spawnTransformEntity(world, transform, traits.SnapshotAPI)

		expect(entity.has(traits.Capsule)).toBe(true)
	})

	it('spawns with Sphere trait from sphere geometry', () => {
		world = createWorld()
		const geometry = new Geometry({
			geometryType: { case: 'sphere', value: { radiusMm: 100 } },
		})
		const transform = new Transform({ referenceFrame: 'sphere1', physicalObject: geometry })

		const entity = spawnTransformEntity(world, transform, traits.SnapshotAPI)

		expect(entity.has(traits.Sphere)).toBe(true)
	})

	it('applies RGB color from metadata', () => {
		world = createWorld()
		const colors = new Uint8Array([255, 128, 0]) // RGB no alpha
		const transform = new Transform({
			referenceFrame: 'colored',
			metadata: {
				fields: {
					colors: { kind: { case: 'stringValue', value: btoa(String.fromCharCode(...colors)) } },
				},
			},
		})

		const entity = spawnTransformEntity(world, transform, traits.SnapshotAPI)

		expect(entity.get(traits.Color)?.r).toBeCloseTo(1.0)
		expect(entity.get(traits.Color)?.g).toBeCloseTo(128 / 255)
		expect(entity.get(traits.Color)?.b).toBeCloseTo(0.0)
		expect(entity.has(traits.Opacity)).toBe(false)
	})

	it('applies RGBA color and opacity from metadata', () => {
		world = createWorld()
		const colors = new Uint8Array([0, 255, 0, 128]) // RGBA
		const transform = new Transform({
			referenceFrame: 'colored-opacity',
			metadata: {
				fields: {
					colors: { kind: { case: 'stringValue', value: btoa(String.fromCharCode(...colors)) } },
				},
			},
		})

		const entity = spawnTransformEntity(world, transform, traits.SnapshotAPI)

		expect(entity.get(traits.Color)?.g).toBeCloseTo(1.0)
		expect(entity.get(traits.Opacity)).toBeCloseTo(128 / 255, 3)
	})
})

describe('spawnDrawingEntities', () => {
	let world: World
	afterEach(() => world?.destroy())

	it('spawns arrows entity with Arrows, Positions, and Instances traits', () => {
		world = createWorld()
		const posesData = new Uint8Array(24) // 1 arrow (6 floats × 4 bytes)
		const drawing = new Drawing({
			referenceFrame: 'arrows1',
			physicalObject: new Shape({
				geometryType: { case: 'arrows', value: new Arrows({ poses: posesData }) },
			}),
		})

		const entities = spawnDrawingEntities(world, drawing, traits.SnapshotAPI)

		expect(entities).toHaveLength(1)
		expect(entities[0].has(traits.Arrows)).toBe(true)
		expect(entities[0].has(traits.Positions)).toBe(true)
		expect(entities[0].has(traits.Instances)).toBe(true)
	})

	it('attaches api trait to spawned drawing entities', () => {
		world = createWorld()
		const drawing = new Drawing({
			referenceFrame: 'arrows1',
			physicalObject: new Shape({
				geometryType: { case: 'arrows', value: new Arrows({ poses: new Uint8Array(24) }) },
			}),
		})

		const entities = spawnDrawingEntities(world, drawing, traits.DrawAPI)

		expect(entities[0].has(traits.DrawAPI)).toBe(true)
	})

	it('spawns arrows with single Color trait for one RGBA color', () => {
		world = createWorld()
		const colors = new Uint8Array([0, 255, 0, 180])
		const drawing = new Drawing({
			referenceFrame: 'arrows-color',
			physicalObject: new Shape({
				geometryType: { case: 'arrows', value: new Arrows({ poses: new Uint8Array(24) }) },
			}),
			metadata: new Metadata({ colors }),
		})

		const [entity] = spawnDrawingEntities(world, drawing, traits.SnapshotAPI)

		expect(entity.get(traits.Color)?.g).toBeCloseTo(1.0)
		expect(entity.get(traits.Opacity)).toBeCloseTo(180 / 255, 3)
		expect(entity.has(traits.Colors)).toBe(false)
	})

	it('spawns arrows with Colors trait for multiple per-arrow colors', () => {
		world = createWorld()
		const colors = new Uint8Array([255, 0, 0, 0, 255, 0]) // 2 RGB colors
		const drawing = new Drawing({
			referenceFrame: 'arrows-multi-color',
			physicalObject: new Shape({
				geometryType: { case: 'arrows', value: new Arrows({ poses: new Uint8Array(48) }) },
			}),
			metadata: new Metadata({ colors }),
		})

		const [entity] = spawnDrawingEntities(world, drawing, traits.SnapshotAPI)

		expect(entity.has(traits.Color)).toBe(false)
		expect(entity.get(traits.Colors)).toStrictEqual(colors)
	})

	it('spawns model with root ReferenceFrame entity and child GLTF entities', () => {
		world = createWorld()
		const url = 'https://example.com/model.gltf'
		const drawing = new Drawing({
			referenceFrame: 'model1',
			physicalObject: new Shape({
				geometryType: {
					case: 'model',
					value: new Model({
						assets: [new ModelAsset({ content: { case: 'url', value: url } })],
						animationName: 'idle',
					}),
				},
			}),
		})

		const entities = spawnDrawingEntities(world, drawing, traits.SnapshotAPI)

		expect(entities).toHaveLength(2) // root + 1 asset
		const rootEntity = entities[0]
		const assetEntity = entities[1]
		expect(rootEntity.has(traits.ReferenceFrame)).toBe(true)
		expect(assetEntity.get(traits.GLTF)).toStrictEqual({ source: { url }, animationName: 'idle' })
	})

	it('spawns model asset with Scale trait when scale is provided', () => {
		world = createWorld()
		const scale = { x: 2, y: 2, z: 2 }
		const drawing = new Drawing({
			referenceFrame: 'scaled-model',
			physicalObject: new Shape({
				geometryType: {
					case: 'model',
					value: new Model({
						assets: [new ModelAsset({ content: { case: 'url', value: 'http://model.gltf' } })],
						scale,
					}),
				},
			}),
		})

		const entities = spawnDrawingEntities(world, drawing, traits.SnapshotAPI)
		const assetEntity = entities[1]

		expect(assetEntity.get(traits.Scale)).toStrictEqual(scale)
	})

	it('spawns multiple entities for multiple model assets plus a root', () => {
		world = createWorld()
		const drawing = new Drawing({
			referenceFrame: 'multi-model',
			physicalObject: new Shape({
				geometryType: {
					case: 'model',
					value: new Model({
						assets: [
							new ModelAsset({ content: { case: 'url', value: 'https://example.com/a.gltf' } }),
							new ModelAsset({ content: { case: 'url', value: 'https://example.com/b.gltf' } }),
						],
					}),
				},
			}),
		})

		const entities = spawnDrawingEntities(world, drawing, traits.SnapshotAPI)

		expect(entities).toHaveLength(3) // root + 2 assets
	})

	it('spawns line entity with LinePositions, LineWidth, and PointSize traits', () => {
		world = createWorld()
		const drawing = new Drawing({
			referenceFrame: 'line1',
			physicalObject: new Shape({
				geometryType: {
					case: 'line',
					value: new Line({ positions: new Uint8Array(24), lineWidth: 3, pointSize: 5 }),
				},
			}),
		})

		const [entity] = spawnDrawingEntities(world, drawing, traits.SnapshotAPI)

		expect(entity.has(traits.LinePositions)).toBe(true)
		expect(entity.has(traits.LineWidth)).toBe(true)
		expect(entity.has(traits.PointSize)).toBe(true)
	})

	it('spawns line with Color and PointColor from two-color metadata', () => {
		world = createWorld()
		const colors = new Uint8Array([255, 0, 0, 0, 0, 255]) // line RGB + point RGB
		const drawing = new Drawing({
			referenceFrame: 'line-colored',
			physicalObject: new Shape({
				geometryType: {
					case: 'line',
					value: new Line({ positions: new Uint8Array(24), lineWidth: 3, pointSize: 5 }),
				},
			}),
			metadata: new Metadata({ colors }),
		})

		const [entity] = spawnDrawingEntities(world, drawing, traits.SnapshotAPI)

		expect(entity.get(traits.Color)?.r).toBeCloseTo(1.0)
		expect(entity.get(traits.PointColor)?.b).toBeCloseTo(1.0)
		expect(entity.has(traits.Opacity)).toBe(false)
	})

	it('spawns points entity with BufferGeometry and Points traits', () => {
		world = createWorld()
		const positions = new Uint8Array(36) // 3 points
		const floats = asFloat32Array(positions)
		const drawing = new Drawing({
			referenceFrame: 'points1',
			physicalObject: new Shape({
				geometryType: {
					case: 'points',
					value: new Points({ positions, pointSize: 8 }),
				},
			}),
		})

		const [entity] = spawnDrawingEntities(world, drawing, traits.SnapshotAPI)

		expect(entity.has(traits.Points)).toBe(true)
		expect(entity.get(traits.BufferGeometry)?.getAttribute('position')?.array).toStrictEqual(floats)
		expect(entity.get(traits.PointSize)).toBeCloseTo(8 * 0.001)
	})

	it('spawns points with per-vertex colors in BufferGeometry', () => {
		world = createWorld()
		const positions = new Uint8Array(12) // 1 point
		const perVertexColors = new Uint8Array([255, 128, 0])
		const drawing = new Drawing({
			referenceFrame: 'vertex-points',
			physicalObject: new Shape({
				geometryType: { case: 'points', value: new Points({ positions }) },
			}),
			metadata: new Metadata({ colors: perVertexColors }),
		})

		const [entity] = spawnDrawingEntities(world, drawing, traits.SnapshotAPI)

		expect(entity.has(traits.Color)).toBe(false)
		expect(entity.get(traits.BufferGeometry)?.getAttribute('color')).toBeTruthy()
	})

	it('spawns points with uniform Color and Opacity from single RGBA color', () => {
		world = createWorld()
		const colors = new Uint8Array([255, 0, 0, 128])
		const drawing = new Drawing({
			referenceFrame: 'uniform-points',
			physicalObject: new Shape({
				geometryType: { case: 'points', value: new Points({ positions: new Uint8Array(24) }) },
			}),
			metadata: new Metadata({ colors }),
		})

		const [entity] = spawnDrawingEntities(world, drawing, traits.SnapshotAPI)

		expect(entity.get(traits.Color)?.r).toBeCloseTo(1.0)
		expect(entity.get(traits.Opacity)).toBeCloseTo(128 / 255, 3)
	})

	it('attaches Center trait when physicalObject has a center', () => {
		world = createWorld()
		const center = createPose({ x: 10, y: 20, z: 30 })
		const drawing = new Drawing({
			referenceFrame: 'centered',
			physicalObject: new Shape({
				center,
				geometryType: { case: 'points', value: new Points({ positions: new Uint8Array(12) }) },
			}),
		})

		const [entity] = spawnDrawingEntities(world, drawing, traits.SnapshotAPI)

		expect(entity.get(traits.Center)).toStrictEqual(center)
	})

	it('attaches Parent trait when parent is not world', () => {
		world = createWorld()
		const drawing = new Drawing({
			referenceFrame: 'child',
			poseInObserverFrame: { referenceFrame: 'parent-frame', pose: createPose() },
			physicalObject: new Shape({
				geometryType: { case: 'points', value: new Points({ positions: new Uint8Array(12) }) },
			}),
		})

		const [entity] = spawnDrawingEntities(world, drawing, traits.SnapshotAPI)

		expect(entity.get(traits.Parent)).toBe('parent-frame')
	})

	it('does not attach Parent trait when parent is world', () => {
		world = createWorld()
		const drawing = new Drawing({
			referenceFrame: 'child',
			poseInObserverFrame: { referenceFrame: 'world', pose: createPose() },
			physicalObject: new Shape({
				geometryType: { case: 'points', value: new Points({ positions: new Uint8Array(12) }) },
			}),
		})

		const [entity] = spawnDrawingEntities(world, drawing, traits.SnapshotAPI)

		expect(entity.has(traits.Parent)).toBe(false)
	})

	it('attaches Removable by default', () => {
		world = createWorld()
		const drawing = new Drawing({
			referenceFrame: 'removable',
			physicalObject: new Shape({
				geometryType: { case: 'points', value: new Points({ positions: new Uint8Array(12) }) },
			}),
		})

		const [entity] = spawnDrawingEntities(world, drawing, traits.SnapshotAPI)

		expect(entity.has(traits.Removable)).toBe(true)
	})

	it('does not attach Removable when removable option is false', () => {
		world = createWorld()
		const drawing = new Drawing({
			referenceFrame: 'permanent',
			physicalObject: new Shape({
				geometryType: { case: 'points', value: new Points({ positions: new Uint8Array(12) }) },
			}),
		})

		const [entity] = spawnDrawingEntities(world, drawing, traits.SnapshotAPI, { removable: false })

		expect(entity.has(traits.Removable)).toBe(false)
	})

	it('returns empty array when drawing has no recognized geometry type', () => {
		world = createWorld()
		const drawing = new Drawing({ referenceFrame: 'empty' })

		const entities = spawnDrawingEntities(world, drawing, traits.SnapshotAPI)

		expect(entities).toHaveLength(1)
		expect(world.query()).toHaveLength(1)
	})
})
