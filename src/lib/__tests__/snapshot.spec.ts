import { createWorld, type World } from 'koota'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('$lib/loaders/pcd', () => ({
	parsePcdInWorker: vi.fn(() => Promise.resolve({ positions: new Float32Array(), colors: null })),
}))
import { Transform } from '$lib/buf/common/v1/common_pb'
import { Arrows, Drawing, Shape } from '$lib/buf/draw/v1/drawing_pb'
import { Snapshot } from '$lib/buf/draw/v1/snapshot_pb'

import { spawnSnapshotEntities } from '../snapshot'

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
