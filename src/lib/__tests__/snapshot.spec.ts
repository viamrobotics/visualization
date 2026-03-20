<<<<<<< HEAD
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createWorld, type World } from 'koota'

vi.mock('$lib/loaders/pcd', () => ({
	parsePcdInWorker: vi.fn(() => Promise.resolve({ positions: new Float32Array(), colors: null })),
}))
import { Snapshot } from '$lib/buf/draw/v1/snapshot_pb'
import { Drawing, Shape, Arrows } from '$lib/buf/draw/v1/drawing_pb'
import { Transform } from '$lib/buf/common/v1/common_pb'
import { spawnSnapshotEntities } from '../snapshot'
=======
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
>>>>>>> 9aea4fa8a3b6027e86a6e4b6024e7629687c853a

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
