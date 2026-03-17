import { createWorld, type World } from 'koota'
import { afterEach, describe, expect, it } from 'vitest'

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
import { Metadata } from '$lib/buf/draw/v1/metadata_pb'
import { Snapshot } from '$lib/buf/draw/v1/snapshot_pb'
import { asFloat32Array } from '$lib/buffer'
import { traits } from '$lib/ecs'
import { createPose } from '$lib/transform'

import { destroyEntities, spawnSnapshotEntities } from '../snapshot'

describe('spawnSnapshotEntities', () => {
	let world: World
	afterEach(() => world?.destroy())

	it('spawns entities for transforms', () => {
		world = createWorld()
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
		world = createWorld()
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
		world = createWorld()
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
		world = createWorld()
		const snapshot = new Snapshot({})

		const entities = spawnSnapshotEntities(world, snapshot)

		expect(entities).toHaveLength(0)
		expect(world.query()).toHaveLength(0)
	})
})

describe('spawnTransformEntity (via spawnSnapshotEntities)', () => {
	let world: World
	afterEach(() => world?.destroy())

	it('spawns with name and pose traits', async () => {
		world = createWorld()
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
		world = createWorld()
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
	let world: World
	afterEach(() => world?.destroy())

	it('spawns arrows shape with Arrow trait', async () => {
		world = createWorld()
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
		world = createWorld()
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
		world = createWorld()
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
		world = createWorld()
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

	it('spawns points with uniform Color + Opacity traits from metadata', async () => {
		world = createWorld()
		// [r, g, b, a] — single RGBA color; use 2 points so 4 bytes is NOT per-vertex count
		const colors = new Uint8Array([255, 0, 0, 128])
		const drawing = new Drawing({
			referenceFrame: 'colored-points',
			physicalObject: new Shape({
				geometryType: { case: 'points', value: new Points({ positions: new Uint8Array(24) }) },
			}),
			metadata: new Metadata({ colors }),
		})
		const snapshot = new Snapshot({ drawings: [drawing] })

		const [entity] = spawnSnapshotEntities(world, snapshot)

		expect(entity.get(traits.Color)?.r).toBeCloseTo(1)
		expect(entity.get(traits.Color)?.g).toBeCloseTo(0)
		expect(entity.get(traits.Color)?.b).toBeCloseTo(0)
		expect(entity.get(traits.Opacity)).toBeCloseTo(128 / 255, 3)
	})

	it('spawns points with per-vertex Colors in BufferGeometry when colors match point count', async () => {
		world = createWorld()
		const positions = new Uint8Array(12) // 1 point (3 floats)
		// 1 point → vertex colors = numPoints * 3 = 3 bytes
		const perVertexColors = new Uint8Array([255, 128, 0])
		const drawing = new Drawing({
			referenceFrame: 'vertex-colored-points',
			physicalObject: new Shape({
				geometryType: { case: 'points', value: new Points({ positions }) },
			}),
			metadata: new Metadata({ colors: perVertexColors }),
		})
		const snapshot = new Snapshot({ drawings: [drawing] })

		const [entity] = spawnSnapshotEntities(world, snapshot)

		// Vertex colors go into BufferGeometry, not the Color trait
		expect(entity.has(traits.Color)).toBe(false)
		expect(entity.get(traits.BufferGeometry)?.getAttribute('color')).toBeTruthy()
	})

	it('spawns line with Color and PointColor traits from metadata', async () => {
		world = createWorld()
		// [lineR, lineG, lineB, dotR, dotG, dotB] — two RGB colors
		const colors = new Uint8Array([255, 0, 0, 0, 0, 255])
		const positions = new Uint8Array(24) // 2 points
		const drawing = new Drawing({
			referenceFrame: 'line-colored',
			physicalObject: new Shape({
				geometryType: {
					case: 'line',
					value: new Line({ positions, lineWidth: 3, pointSize: 5 }),
				},
			}),
			metadata: new Metadata({ colors }),
		})
		const snapshot = new Snapshot({ drawings: [drawing] })

		const [entity] = spawnSnapshotEntities(world, snapshot)

		expect(entity.get(traits.Color)?.r).toBeCloseTo(1)
		expect(entity.get(traits.Color)?.g).toBeCloseTo(0)
		expect(entity.get(traits.Color)?.b).toBeCloseTo(0)
		expect(entity.get(traits.PointColor)?.r).toBeCloseTo(0)
		expect(entity.get(traits.PointColor)?.g).toBeCloseTo(0)
		expect(entity.get(traits.PointColor)?.b).toBeCloseTo(1)
		// RGB (no alpha) — no Opacity trait
		expect(entity.has(traits.Opacity)).toBe(false)
	})

	it('spawns arrows with Colors trait when metadata has one color', async () => {
		world = createWorld()
		// Single RGBA color for all arrows
		const colors = new Uint8Array([0, 255, 0, 180])
		const posesData = new Uint8Array(24) // 1 arrow
		const drawing = new Drawing({
			referenceFrame: 'arrows-single-color',
			physicalObject: new Shape({
				geometryType: { case: 'arrows', value: new Arrows({ poses: posesData }) },
			}),
			metadata: new Metadata({ colors }),
		})
		const snapshot = new Snapshot({ drawings: [drawing] })

		const [entity] = spawnSnapshotEntities(world, snapshot)

		const entityColors = entity.get(traits.Colors)
		expect(entityColors).toBeDefined()
		expect(entityColors![0]).toBe(0)
		expect(entityColors![1]).toBe(255)
		expect(entityColors![2]).toBe(0)
		expect(entityColors![3]).toBe(180)
		expect(entity.has(traits.Color)).toBe(false)
	})

	it('spawns arrows with Colors trait when metadata has multiple colors', async () => {
		world = createWorld()
		// Two RGB colors — one per arrow
		const colors = new Uint8Array([255, 0, 0, 0, 255, 0])
		const posesData = new Uint8Array(48) // 2 arrows
		const drawing = new Drawing({
			referenceFrame: 'arrows-multi-color',
			physicalObject: new Shape({
				geometryType: { case: 'arrows', value: new Arrows({ poses: posesData }) },
			}),
			metadata: new Metadata({ colors }),
		})
		const snapshot = new Snapshot({ drawings: [drawing] })

		const [entity] = spawnSnapshotEntities(world, snapshot)

		expect(entity.has(traits.Color)).toBe(false)
		expect(entity.get(traits.Colors)).toStrictEqual(colors)
	})
})

describe('model shape handling', () => {
	let world: World
	afterEach(() => world?.destroy())

	it('spawns model with URL content', async () => {
		world = createWorld()
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
								sizeBytes: 1024n,
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
		world = createWorld()
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
								sizeBytes: 4n,
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
		world = createWorld()
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

describe('destroyEntities', () => {
	let world: World
	afterEach(() => world?.destroy())

	it('destroys all spawned entities', () => {
		world = createWorld()
		const snapshot = new Snapshot({
			transforms: [new Transform({ referenceFrame: 'a' }), new Transform({ referenceFrame: 'b' })],
		})

		const entities = spawnSnapshotEntities(world, snapshot)
		expect(world.query()).toHaveLength(2)

		destroyEntities(world, entities)
		expect(world.query()).toHaveLength(0)
	})

	it('silently skips already-destroyed entities', () => {
		world = createWorld()
		const snapshot = new Snapshot({
			transforms: [new Transform({ referenceFrame: 'a' }), new Transform({ referenceFrame: 'b' })],
		})
		const entities = spawnSnapshotEntities(world, snapshot)
		expect(world.query()).toHaveLength(2)

		entities[0]!.destroy()
		expect(() => destroyEntities(world, entities)).not.toThrow()
	})
})

describe('colors', () => {
	let world: World
	afterEach(() => world?.destroy())

	it('spawns points with per-vertex RGBA colors in BufferGeometry', async () => {
		world = createWorld()
		// 2 points, RGBA per-vertex: 2 * 4 = 8 bytes
		const positions = new Uint8Array(24) // 2 points (2 * 3 floats * 4 bytes)
		const perVertexColors = new Uint8Array([255, 0, 0, 255, 0, 255, 0, 128])
		const drawing = new Drawing({
			referenceFrame: 'rgba-vertex-points',
			physicalObject: new Shape({
				geometryType: { case: 'points', value: new Points({ positions }) },
			}),
			metadata: new Metadata({ colors: perVertexColors }),
		})
		const snapshot = new Snapshot({ drawings: [drawing] })

		const [entity] = spawnSnapshotEntities(world, snapshot)

		expect(entity.has(traits.Color)).toBe(false)
		expect(entity.get(traits.BufferGeometry)?.getAttribute('color')).toBeTruthy()
	})

	it('spawns arrows with no colors when metadata has no colors', async () => {
		world = createWorld()
		const drawing = new Drawing({
			referenceFrame: 'no-color-arrows',
			physicalObject: new Shape({
				geometryType: { case: 'arrows', value: new Arrows({ poses: new Uint8Array(24) }) },
			}),
		})
		const snapshot = new Snapshot({ drawings: [drawing] })

		const [entity] = spawnSnapshotEntities(world, snapshot)

		expect(entity.has(traits.Colors)).toBe(false)
		expect(entity.has(traits.Color)).toBe(false)
	})

	it('spawns line with RGBA colors including opacity', async () => {
		world = createWorld()
		// Two RGBA colors: line + point
		const colors = new Uint8Array([255, 0, 0, 200, 0, 0, 255, 100])
		const drawing = new Drawing({
			referenceFrame: 'line-rgba',
			physicalObject: new Shape({
				geometryType: {
					case: 'line',
					value: new Line({ positions: new Uint8Array(24), lineWidth: 2, pointSize: 3 }),
				},
			}),
			metadata: new Metadata({ colors }),
		})
		const snapshot = new Snapshot({ drawings: [drawing] })

		const [entity] = spawnSnapshotEntities(world, snapshot)

		expect(entity.get(traits.Color)?.r).toBeCloseTo(1)
		expect(entity.get(traits.PointColor)?.b).toBeCloseTo(1)
		expect(entity.get(traits.Opacity)).toBeCloseTo(200 / 255, 3)
	})

	it('spawns line with only line color when metadata has one RGB entry', async () => {
		world = createWorld()
		const colors = new Uint8Array([0, 255, 0])
		const drawing = new Drawing({
			referenceFrame: 'line-single',
			physicalObject: new Shape({
				geometryType: {
					case: 'line',
					value: new Line({ positions: new Uint8Array(24), lineWidth: 1, pointSize: 1 }),
				},
			}),
			metadata: new Metadata({ colors }),
		})
		const snapshot = new Snapshot({ drawings: [drawing] })

		const [entity] = spawnSnapshotEntities(world, snapshot)

		expect(entity.get(traits.Color)?.g).toBeCloseTo(1)
		expect(entity.has(traits.PointColor)).toBe(false)
		expect(entity.has(traits.Opacity)).toBe(false)
	})

	it('spawns points with no color traits when metadata is absent', async () => {
		world = createWorld()
		const drawing = new Drawing({
			referenceFrame: 'plain-points',
			physicalObject: new Shape({
				geometryType: {
					case: 'points',
					value: new Points({ positions: new Uint8Array(12), pointSize: 5 }),
				},
			}),
		})
		const snapshot = new Snapshot({ drawings: [drawing] })

		const [entity] = spawnSnapshotEntities(world, snapshot)

		expect(entity.has(traits.Color)).toBe(false)
		expect(entity.has(traits.Opacity)).toBe(false)
		expect(entity.has(traits.BufferGeometry)).toBe(true)
		expect(entity.has(traits.Points)).toBe(true)
	})
})
