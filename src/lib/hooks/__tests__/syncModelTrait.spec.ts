import { createWorld, type Entity, type World } from 'koota'
import { Group } from 'three'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { traits } from '#lib/ecs/index.js'

import { syncModelTrait } from '../use3DModels.svelte'

describe('syncModelTrait', () => {
	let world: World
	let link: Entity

	beforeEach(() => {
		world = createWorld()
		link = world.spawn(traits.Name('arm:link1'))
	})

	afterEach(() => {
		world.destroy()
	})

	it('hides the collider of a link drawing its model alone', () => {
		syncModelTrait(link, new Group(), 'model')

		expect(link.has(traits.ColliderHidden), 'the model should replace the collider').toBe(true)
	})

	it('keeps the collider of a link with no model, even when only models are drawn', () => {
		syncModelTrait(link, undefined, 'model')

		expect(link.has(traits.ColliderHidden), 'a missing model falls back to the collider').toBe(
			false
		)
	})

	it('shows the collider again once the display asks for both', () => {
		const model = new Group()
		syncModelTrait(link, model, 'model')

		syncModelTrait(link, model, 'colliders+model')

		expect(link.has(traits.ColliderHidden), 'both should draw').toBe(false)
	})

	it('shows the collider again when the model is taken away', () => {
		syncModelTrait(link, new Group(), 'model')

		syncModelTrait(link, undefined, 'model')

		expect(link.has(traits.ColliderHidden), 'the collider is all that is left to draw').toBe(false)
	})
})
