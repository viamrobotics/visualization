import RAPIER from '@dimforge/rapier3d-compat'
import { createWorld, type Entity } from 'koota'
import { Matrix4 } from 'three'
import { beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { traits } from '$lib/ecs'

import { createCollisionWorld } from '../collisionWorld'
import { ENVIRONMENT_BIT } from '../interactionGroups'

/**
 * Exercises the real Rapier pipeline rather than a stand-in. Every collider
 * here is parentless, which Rapier treats as fixed, and fixed-vs-fixed pairs
 * are rejected by default — a mistake no amount of mocking would catch.
 */
beforeAll(async () => {
	await RAPIER.init()
})

const ARM_BIT = 1
const OTHER_ARM_BIT = 2

/** A 200mm cube — half-extents of 0.1m, so two overlap below 0.2m apart. */
const CUBE_MM = 200

let world: ReturnType<typeof createWorld>
let physics: RAPIER.World
let collisions: ReturnType<typeof createCollisionWorld>

const spawnCube = (x: number): Entity =>
	world.spawn(
		traits.Box({ x: CUBE_MM, y: CUBE_MM, z: CUBE_MM }),
		traits.WorldMatrix(new Matrix4().makeTranslation(x, 0, 0))
	)

const moveTo = (entity: Entity, x: number) => {
	entity.get(traits.WorldMatrix)?.makeTranslation(x, 0, 0)
}

beforeEach(() => {
	world = createWorld()
	physics = new RAPIER.World({ x: 0, y: 0, z: 0 })
	collisions = createCollisionWorld(RAPIER, physics)
})

describe('createCollisionWorld', () => {
	it('detects two overlapping colliders in different groups', () => {
		const arm = spawnCube(0)
		const obstacle = spawnCube(0.15)

		collisions.sync([
			{ entity: arm, bit: ARM_BIT },
			{ entity: obstacle, bit: ENVIRONMENT_BIT },
		])

		const pairs = collisions.detect()
		expect(pairs).toHaveLength(1)
		expect(new Set([pairs[0]?.a, pairs[0]?.b])).toEqual(new Set([arm, obstacle]))
	})

	it('reports a pair once, not once per side', () => {
		collisions.sync([
			{ entity: spawnCube(0), bit: ARM_BIT },
			{ entity: spawnCube(0.15), bit: ENVIRONMENT_BIT },
		])

		expect(collisions.detect()).toHaveLength(1)
	})

	it('ignores overlapping colliders that share an arm bit', () => {
		collisions.sync([
			{ entity: spawnCube(0), bit: ARM_BIT },
			{ entity: spawnCube(0.15), bit: ARM_BIT },
		])

		expect(collisions.detect()).toHaveLength(0)
	})

	it('still checks one arm against another', () => {
		collisions.sync([
			{ entity: spawnCube(0), bit: ARM_BIT },
			{ entity: spawnCube(0.15), bit: OTHER_ARM_BIT },
		])

		expect(collisions.detect()).toHaveLength(1)
	})

	it('ignores scenery touching scenery, however much of it a scene has', () => {
		// The failure this guards: a big cell is full of fixtures bolted to tables
		// and tables standing on floors, all overlapping by design. Reporting those
		// buries the one pair that matters and paints most of the scene red.
		collisions.sync(
			[0, 0.15, 0.3, 0.45].map((x) => ({ entity: spawnCube(x), bit: ENVIRONMENT_BIT }))
		)

		expect(collisions.detect()).toHaveLength(0)
	})

	it('leaves separated colliders alone', () => {
		collisions.sync([
			{ entity: spawnCube(0), bit: ARM_BIT },
			{ entity: spawnCube(0.5), bit: ENVIRONMENT_BIT },
		])

		expect(collisions.detect()).toHaveLength(0)
	})

	it('follows colliders as they move, in both directions', () => {
		const moving = spawnCube(0.5)
		const fixed = spawnCube(0)
		const members = [
			{ entity: moving, bit: ARM_BIT },
			{ entity: fixed, bit: ENVIRONMENT_BIT },
		]

		collisions.sync(members)
		expect(collisions.detect()).toHaveLength(0)

		moveTo(moving, 0.15)
		collisions.sync(members)
		expect(collisions.detect()).toHaveLength(1)

		moveTo(moving, 0.5)
		collisions.sync(members)
		expect(collisions.detect()).toHaveLength(0)
	})

	it('drops colliders for entities that leave the member set', () => {
		const arm = spawnCube(0)
		const obstacle = spawnCube(0.15)

		collisions.sync([
			{ entity: arm, bit: ARM_BIT },
			{ entity: obstacle, bit: ENVIRONMENT_BIT },
		])
		expect(collisions.detect()).toHaveLength(1)

		collisions.sync([{ entity: arm, bit: ARM_BIT }])
		expect(collisions.detect()).toHaveLength(0)
	})

	it('detects a capsule overlapping along Z, the axis the scene draws it on', () => {
		// 400mm long, 50mm radius: spans ±0.2m on Z once oriented. A cube at
		// z = 0.15 only overlaps if the capsule was rotated off Rapier's Y default.
		const capsule = world.spawn(
			traits.Capsule({ l: 400, r: 50 }),
			traits.WorldMatrix(new Matrix4())
		)
		const cube = world.spawn(
			traits.Box({ x: 50, y: 50, z: 50 }),
			traits.WorldMatrix(new Matrix4().makeTranslation(0, 0, 0.15))
		)

		collisions.sync([
			{ entity: capsule, bit: ARM_BIT },
			{ entity: cube, bit: ENVIRONMENT_BIT },
		])

		expect(collisions.detect()).toHaveLength(1)
	})

	it('leaves the borrowed world intact on dispose', () => {
		collisions.sync([
			{ entity: spawnCube(0), bit: ARM_BIT },
			{ entity: spawnCube(0.15), bit: ENVIRONMENT_BIT },
		])
		collisions.dispose()

		expect(physics.colliders.len()).toBe(0)
		expect(() => physics.step()).not.toThrow()
	})
})
