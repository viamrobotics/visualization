import { createWorld, type World } from 'koota'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('$lib/loaders/pcd', () => ({
	parsePcdInWorker: vi.fn(() =>
		Promise.resolve({ id: 0, positions: new Float32Array(), colors: null })
	),
}))

import { Pose, PoseInFrame, Transform } from '$lib/buf/common/v1/common_pb'
import { Arrows, Drawing, Line, Shape } from '$lib/buf/draw/v1/drawing_pb'
import { Snapshot } from '$lib/buf/draw/v1/snapshot_pb'
import { traits } from '$lib/ecs'

import { uuidStringToBytes } from '../draw'
import { reconcileSnapshotEntities, type SnapshotEntity, spawnSnapshotEntities } from '../snapshot'

const UUID_A = '11111111-1111-1111-1111-111111111111'
const UUID_B = '22222222-2222-2222-2222-222222222222'

describe('spawnSnapshotEntities', () => {
	let world: World
	afterEach(() => world?.destroy())

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
})

describe('reconcileSnapshotEntities', () => {
	let world: World
	afterEach(() => world?.destroy())

	const transformWith = (uuid: string, pose: Partial<Pose> = {}) =>
		new Transform({
			referenceFrame: `frame-${uuid.slice(0, 4)}`,
			uuid: uuidStringToBytes(uuid),
			poseInObserverFrame: new PoseInFrame({ pose: new Pose(pose) }),
		})

	it('updates an existing entity in place when its UUID is reused', () => {
		world = createWorld()
		const first = new Snapshot({ transforms: [transformWith(UUID_A, { x: 1 })] })
		const initial = reconcileSnapshotEntities(world, first, new Map())
		const initialEntity = initial.current.get(UUID_A)?.entity
		expect(initialEntity).toBeDefined()
		// Pose translation is in mm. Matrix translation is in m, so the factor is 0.001.
		expect(initialEntity?.get(traits.Matrix)?.elements[12]).toBeCloseTo(0.001)

		const second = new Snapshot({ transforms: [transformWith(UUID_A, { x: 5 })] })
		const next = reconcileSnapshotEntities(world, second, initial.current)

		expect(next.current.get(UUID_A)?.entity).toBe(initialEntity)
		expect(next.spawned).toHaveLength(0)
		expect(next.updated).toHaveLength(1)
		expect(initialEntity?.get(traits.Matrix)?.elements[12]).toBeCloseTo(0.005)
	})

	it('spawns entities for UUIDs not present in the previous map', () => {
		world = createWorld()
		const first = new Snapshot({ transforms: [transformWith(UUID_A)] })
		const initial = reconcileSnapshotEntities(world, first, new Map())

		const second = new Snapshot({
			transforms: [transformWith(UUID_A), transformWith(UUID_B)],
		})
		const next = reconcileSnapshotEntities(world, second, initial.current)

		expect(next.current.has(UUID_A)).toBe(true)
		expect(next.current.has(UUID_B)).toBe(true)
		expect(next.spawned).toHaveLength(1)
		expect(next.spawned[0]?.entity).toBe(next.current.get(UUID_B)?.entity)
	})

	it('destroys entities whose UUIDs are absent from the new snapshot', () => {
		world = createWorld()
		const first = new Snapshot({
			transforms: [transformWith(UUID_A), transformWith(UUID_B)],
		})
		const initial = reconcileSnapshotEntities(world, first, new Map())
		const removed = initial.current.get(UUID_B)?.entity

		const second = new Snapshot({ transforms: [transformWith(UUID_A)] })
		const next = reconcileSnapshotEntities(world, second, initial.current)

		expect(next.current.has(UUID_A)).toBe(true)
		expect(next.current.has(UUID_B)).toBe(false)
		expect(removed && world.has(removed)).toBe(false)
	})

	it('updates a non-model drawing in place', () => {
		world = createWorld()
		const drawingWith = (size: number) =>
			new Drawing({
				referenceFrame: 'drawing',
				uuid: uuidStringToBytes(UUID_A),
				physicalObject: new Shape({
					geometryType: {
						case: 'arrows',
						value: new Arrows({ poses: new Uint8Array(new ArrayBuffer(size)) }),
					},
				}),
			})

		const first = new Snapshot({ drawings: [drawingWith(24)] })
		const initial = reconcileSnapshotEntities(world, first, new Map())
		const entity = initial.current.get(UUID_A)?.entity
		expect(entity).toBeDefined()

		const second = new Snapshot({ drawings: [drawingWith(48)] })
		const next = reconcileSnapshotEntities(world, second, initial.current)

		expect(next.current.get(UUID_A)?.entity).toBe(entity)
		expect(next.spawned).toHaveLength(0)
		expect(next.updated).toHaveLength(1)
	})

	it('returns drawings without a UUID in the unkeyed list', () => {
		world = createWorld()
		const drawing = new Drawing({
			referenceFrame: 'no-uuid',
			physicalObject: new Shape({
				geometryType: {
					case: 'line',
					value: new Line({ positions: new Uint8Array(new ArrayBuffer(36)) }),
				},
			}),
		})
		const snapshot = new Snapshot({ drawings: [drawing] })

		const result = reconcileSnapshotEntities(world, snapshot, new Map())

		expect(result.current.size).toBe(0)
		expect(result.unkeyed).toHaveLength(1)
		expect(result.spawned).toHaveLength(1)
	})

	it('handles a mix of update, add, and remove in one pass', () => {
		world = createWorld()
		const first = new Snapshot({
			transforms: [transformWith(UUID_A, { x: 1 }), transformWith(UUID_B, { x: 2 })],
		})
		const initial = reconcileSnapshotEntities(world, first, new Map())
		const keptEntity = initial.current.get(UUID_A)?.entity
		const removedEntity = initial.current.get(UUID_B)?.entity

		const UUID_C = '33333333-3333-3333-3333-333333333333'
		const second = new Snapshot({
			transforms: [transformWith(UUID_A, { x: 9 }), transformWith(UUID_C, { x: 7 })],
		})
		const next: { current: Map<string, SnapshotEntity> } = reconcileSnapshotEntities(
			world,
			second,
			initial.current
		)

		expect(next.current.get(UUID_A)?.entity).toBe(keptEntity)
		expect(keptEntity?.get(traits.Matrix)?.elements[12]).toBeCloseTo(0.009)
		expect(removedEntity && world.has(removedEntity)).toBe(false)
		expect(next.current.has(UUID_C)).toBe(true)
		expect(next.current.size).toBe(2)
	})
})
