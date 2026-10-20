import type { Entity, World } from 'koota'

import { hierarchy, traits } from '$lib/ecs'
import { Pose } from '$lib/math'

export const createEntityFixture = (world: World): Entity => {
	return world.spawn(
		...hierarchy.parentTraits('parent_frame'),
		traits.Name('Test Object'),
		traits.Matrix(new Pose(10, 20, 30, 0.6, 0.8, 0, 0.4).toMatrix4()),
		traits.EditedMatrix(new Pose(10, 20, 30, 0.6, 0.8, 0, 0.4).toMatrix4()),
		traits.Box({ x: 0.01, y: 0.02, z: 0.03 })
	)
}
