import { createWorld, type World } from 'koota'
import { afterEach, describe, expect, it } from 'vitest'

import { traits } from '$lib/ecs'

import { addOpacityOverrideListeners } from '../useOpacityOverrides.svelte'

describe('opacityOverrides system', () => {
	let world: World
	let unsub: (() => void) | undefined

	afterEach(() => {
		unsub?.()
		unsub = undefined
		world?.destroy()
	})

	it('restores an override onto an entity respawned under the same name', () => {
		world = createWorld()
		unsub = addOpacityOverrideListeners(world)
		world.spawn(traits.Name('arm:link1'), traits.OpacityOverride(0.3)).destroy()

		const respawned = world.spawn(traits.Name('arm:link1'))

		expect(respawned.get(traits.OpacityOverride)).toBe(0.3)
	})

	it('restores an override onto an entity respawned under the same uuid', () => {
		world = createWorld()
		unsub = addOpacityOverrideListeners(world)
		world.spawn(traits.UUID('obstacle-1'), traits.OpacityOverride(0.3)).destroy()

		const respawned = world.spawn(traits.UUID('obstacle-1'))

		expect(respawned.get(traits.OpacityOverride)).toBe(0.3)
	})

	it('records the latest value when the user drags the slider again', () => {
		world = createWorld()
		unsub = addOpacityOverrideListeners(world)
		const entity = world.spawn(traits.Name('arm:link1'), traits.OpacityOverride(0.3))
		entity.set(traits.OpacityOverride, 0.9)
		entity.destroy()

		const respawned = world.spawn(traits.Name('arm:link1'))

		expect(respawned.get(traits.OpacityOverride)).toBe(0.9)
	})

	it('leaves an entity nobody has edited without the trait', () => {
		world = createWorld()
		unsub = addOpacityOverrideListeners(world)

		expect(world.spawn(traits.Name('arm:link2')).has(traits.OpacityOverride)).toBe(false)
	})

	it('matches on uuid when a respawn lists its traits in the other order', () => {
		world = createWorld()
		unsub = addOpacityOverrideListeners(world)
		world
			.spawn(traits.UUID('obstacle-1'), traits.Name('box'), traits.OpacityOverride(0.3))
			.destroy()

		const respawned = world.spawn(traits.Name('box'), traits.UUID('obstacle-1'))

		expect(respawned.get(traits.OpacityOverride)).toBe(0.3)
	})
})
