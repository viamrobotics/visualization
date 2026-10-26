import { createWorld, type Entity } from 'koota'
import { beforeEach, describe, expect, it } from 'vitest'

import { traits } from '$lib/ecs'

import type { CollisionReport } from '../collisionReport'

import { createCollisionEntities } from '../collisionEntities'
import { CollidesWith } from '../relations'
import { Collision } from '../traits'

let world: ReturnType<typeof createWorld>
let pairs: ReturnType<typeof createCollisionEntities>

beforeEach(() => {
	world = createWorld()
	pairs = createCollisionEntities(world)
})

const live = (name: string) => world.spawn(traits.Name(name))

const report = (
	a: Entity,
	b: Entity,
	overrides: Partial<CollisionReport> = {}
): CollisionReport => {
	const aName = a.get(traits.Name) ?? ''
	const bName = b.get(traits.Name) ?? ''
	return {
		key: `live:${aName}-${bName}`,
		a: { name: aName, entity: a },
		b: { name: bName, entity: b },
		staged: false,
		depth: 0.01,
		point: { x: 0, y: 0, z: 0 },
		...overrides,
	}
}

const pairEntities = () => [...world.query(Collision)]

describe('createCollisionEntities', () => {
	it('names a pair after both sides', () => {
		pairs.sync([report(live('gripper'), live('table'))])

		expect(pairEntities()[0]?.get(traits.Name)).toBe('gripper ↔ table')
	})

	it('labels a staged pair apart from a live one', () => {
		pairs.sync([report(live('gripper'), live('table'), { key: 'staged', staged: true })])

		expect(pairEntities()[0]?.get(traits.Name)).toBe('gripper ↔ table (after move)')
	})

	it('links a pair to both of its sides', () => {
		const gripper = live('gripper')
		const table = live('table')

		pairs.sync([report(gripper, table)])

		expect(new Set(pairEntities()[0]?.targetsFor(CollidesWith))).toEqual(new Set([gripper, table]))
	})

	it('keeps the same entity for a pair across passes, so its row and selection hold', () => {
		const gripper = live('gripper')
		const table = live('table')
		pairs.sync([report(gripper, table)])
		const first = pairEntities()[0]

		pairs.sync([report(gripper, table, { depth: 0.02 })])

		expect(pairEntities()).toEqual([first])
	})

	it('updates a kept pair with the latest depth', () => {
		const gripper = live('gripper')
		const table = live('table')
		pairs.sync([report(gripper, table)])

		pairs.sync([report(gripper, table, { depth: 0.02 })])

		expect(pairEntities()[0]?.get(Collision)?.depth).toBe(0.02)
	})

	it('repoints a kept pair when a different collider now carries one of its names', () => {
		const table = live('table')
		const firstLink = live('arm')
		const secondLink = live('arm')
		pairs.sync([report(firstLink, table)])

		pairs.sync([report(secondLink, table)])

		expect(new Set(pairEntities()[0]?.targetsFor(CollidesWith))).toEqual(
			new Set([secondLink, table])
		)
	})

	it('destroys a pair that is no longer reported', () => {
		pairs.sync([report(live('gripper'), live('table'))])

		pairs.sync([])

		expect(pairEntities()).toHaveLength(0)
	})

	it('destroys a pair when one of its sides is destroyed', () => {
		const gripper = live('gripper')
		pairs.sync([report(gripper, live('table'))])

		gripper.destroy()

		expect(pairEntities()).toHaveLength(0)
	})

	it('spawns a fresh pair after its side was destroyed and the names overlap again', () => {
		const table = live('table')
		const gripper = live('gripper')
		pairs.sync([report(gripper, table)])
		gripper.destroy()

		pairs.sync([report(live('gripper'), table)])

		expect(pairEntities()).toHaveLength(1)
	})

	it('destroys every pair on clear', () => {
		pairs.sync([report(live('gripper'), live('table')), report(live('arm'), live('shelf'))])

		pairs.clear()

		expect(pairEntities()).toHaveLength(0)
	})
})
