import type { Entity, World } from 'koota'
import { traits } from '$lib/ecs'

export const createEntityFixture = (world: World): Entity => {
	return world.spawn(
		traits.UUID('1234-5678'),
		traits.Parent('parent_frame'),
		traits.Name('Test Object'),
		traits.Pose({
			x: 10,
			y: 20,
			z: 30,
			oX: 0.1,
			oY: 0.2,
			oZ: 0.3,
			theta: 0.4,
		}),
		traits.EditedPose({
			x: 10,
			y: 20,
			z: 30,
			oX: 0.1,
			oY: 0.2,
			oZ: 0.3,
			theta: 0.4,
		}),
		traits.Box({ x: 0.01, y: 0.02, z: 0.03 })
	)
}
