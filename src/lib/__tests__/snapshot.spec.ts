import { afterEach, describe, expect, it, vi } from 'vitest'
import { createWorld, type World } from 'koota'

vi.mock('$lib/loaders/pcd', () => ({
	parsePcdInWorker: vi.fn(() => Promise.resolve({ positions: new Float32Array(), colors: null })),
}))

import { Snapshot } from '$lib/buf/draw/v1/snapshot_pb'
import { Drawing, Shape, Arrows, Points } from '$lib/buf/draw/v1/drawing_pb'
import { Transform } from '$lib/buf/common/v1/common_pb'
import { spawnSnapshotEntities } from '../snapshot'
import { createPose } from '$lib/transform'

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
