import { createWorld, type World } from 'koota'
import { afterEach, describe, expect, it } from 'vitest'

import { setOrAddTrait } from '../setOrAddTrait'
import * as traits from '../traits'

describe('setOrAddTrait', () => {
	let world: World

	afterEach(() => world?.destroy())

	it('adds the trait when the entity does not have it', () => {
		world = createWorld()
		const entity = world.spawn(traits.Name('gantry'))

		setOrAddTrait(entity, traits.Color, { r: 0.5, g: 0.25, b: 0.125 })

		expect(entity.has(traits.Color)).toBe(true)
		expect(entity.get(traits.Color)).toEqual({ r: 0.5, g: 0.25, b: 0.125 })
	})

	it('overwrites the value when the entity already has the trait', () => {
		world = createWorld()
		const entity = world.spawn(traits.Color({ r: 1, g: 1, b: 1 }))

		setOrAddTrait(entity, traits.Color, { r: 0, g: 0, b: 1 })

		expect(entity.get(traits.Color)).toEqual({ r: 0, g: 0, b: 1 })
	})
})
