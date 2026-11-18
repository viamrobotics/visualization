import { createWorld, type World } from 'koota'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { clickSelectionTarget } from '../clickSelectionTarget'
import { ChildOf } from '../relations'
import * as traits from '../traits'

let world: World

beforeEach(() => {
	world = createWorld()
})

afterEach(() => {
	world.destroy()
})

describe('clickSelectionTarget', () => {
	it('selects the obstacle an obstacle shape belongs to', () => {
		const obstacle = world.spawn(traits.Name('obstacle-1'), traits.Editable)
		const shape = world.spawn(
			traits.Name('obstacle-1:shape'),
			traits.KinematicLink,
			traits.ObstacleShape,
			ChildOf(obstacle)
		)

		expect(clickSelectionTarget(shape)).toBe(obstacle)
	})

	it('selects an arm link itself', () => {
		const arm = world.spawn(traits.Name('arm'), traits.Editable)
		const link = world.spawn(traits.Name('arm:upper_arm'), traits.KinematicLink, ChildOf(arm))

		expect(clickSelectionTarget(link)).toBe(link)
	})

	it('selects an obstacle shape itself while its obstacle is not in the scene', () => {
		const shape = world.spawn(traits.Name('obstacle-1:shape'), traits.ObstacleShape)

		expect(clickSelectionTarget(shape)).toBe(shape)
	})
})
