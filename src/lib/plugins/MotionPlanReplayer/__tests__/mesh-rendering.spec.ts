import { createWorld, type World } from 'koota'
import { afterEach, describe, expect, it } from 'vitest'

import { traits } from '$lib/ecs'
import { spawnSnapshotEntities } from '$lib/snapshot'

import { parsePlan } from '../parse-plan'
import { parsedPlanToSnapshots } from '../plan-to-snapshots'
import saladPlan from './__fixtures__/salad-plan.json?raw'

describe('mesh geometry reaches the renderer', () => {
	let world: World
	afterEach(() => world?.destroy())

	it('spawns the scoop frames with non-empty parsed geometry', () => {
		world = createWorld()
		const snapshots = parsedPlanToSnapshots(parsePlan(saladPlan))
		spawnSnapshotEntities(world, snapshots[0]!)

		const scoops = world
			.query(traits.Name, traits.BufferGeometry)
			.filter((entity) => entity.get(traits.Name)!.startsWith('scoop-gripper:scoop_'))

		expect(scoops).toHaveLength(2)

		for (const entity of scoops) {
			// 38 is what the capture's PLY header declares; a mis-decoded payload yields 0.
			const position = entity.get(traits.BufferGeometry)!.getAttribute('position')
			expect(position.count).toBe(38)
		}
	})
})
