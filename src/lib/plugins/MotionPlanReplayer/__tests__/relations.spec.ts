import { createWorld, type World } from 'koota'
import { afterEach, describe, expect, it } from 'vitest'

import { relations, traits } from '$lib/ecs'

import { PartOfPlan } from '../relations'

describe('PartOfPlan', () => {
	let world: World
	afterEach(() => world?.destroy())

	it('destroys every member when the plan root is destroyed', () => {
		world = createWorld()
		const planRoot = world.spawn(traits.Name('plan'))
		const member = world.spawn(PartOfPlan(planRoot))
		const nestedParent = world.spawn(PartOfPlan(planRoot))
		const nestedChild = world.spawn(relations.ChildOf(nestedParent), PartOfPlan(planRoot))

		planRoot.destroy()

		expect(planRoot.isAlive()).toBe(false)
		expect(member.isAlive()).toBe(false)
		expect(nestedParent.isAlive()).toBe(false)
		expect(nestedChild.isAlive()).toBe(false)
	})

	it('leaves entities outside the plan alone', () => {
		world = createWorld()
		const planRoot = world.spawn(traits.Name('plan'))
		const member = world.spawn(PartOfPlan(planRoot))
		const unrelated = world.spawn(traits.Name('unrelated'))

		planRoot.destroy()

		expect(member.isAlive()).toBe(false)
		expect(unrelated.isAlive()).toBe(true)
	})
})
