import { createWorld, type World } from 'koota'
import { afterEach, describe, expect, it } from 'vitest'

import { traits } from '$lib/ecs'

import { selectEntitiesByName } from '../useDeepLinkSelection.svelte'

describe('selectEntitiesByName', () => {
	let world: World

	afterEach(() => {
		world?.destroy()
	})

	it('selects an entity already carrying the name at call time', () => {
		world = createWorld()
		const armEntity = world.spawn(traits.Name('arm-1'))

		selectEntitiesByName(world, ['arm-1'])

		expect(armEntity.has(traits.Selected)).toBe(true)
	})

	it('selects an entity once it spawns with a pending name', () => {
		world = createWorld()

		selectEntitiesByName(world, ['arm-1'])
		const armEntity = world.spawn(traits.Name('arm-1'))

		expect(armEntity.has(traits.Selected)).toBe(true)
	})

	it('resolves multiple names without clearing an entity already selected', () => {
		world = createWorld()
		const armEntity = world.spawn(traits.Name('arm-1'))
		const preselectedEntity = world.spawn(traits.Name('other'), traits.Selected)

		selectEntitiesByName(world, ['arm-1', 'base-1'])
		const baseEntity = world.spawn(traits.Name('base-1'))

		expect(armEntity.has(traits.Selected)).toBe(true)
		expect(baseEntity.has(traits.Selected)).toBe(true)
		expect(preselectedEntity.has(traits.Selected)).toBe(true)
	})

	it('skips a NonSelectable entity and selects a later plain entity with the same name', () => {
		world = createWorld()
		const ghostEntity = world.spawn(traits.Name('arm-1'), traits.NonSelectable)

		selectEntitiesByName(world, ['arm-1'])
		const realEntity = world.spawn(traits.Name('arm-1'))

		expect(ghostEntity.has(traits.Selected)).toBe(false)
		expect(realEntity.has(traits.Selected)).toBe(true)
	})

	it('does not throw when a name never appears', () => {
		world = createWorld()

		expect(() => selectEntitiesByName(world, ['missing'])).not.toThrow()
	})

	it('does not re-select an entity the user deselected after it resolved', () => {
		world = createWorld()
		const armEntity = world.spawn(traits.Name('arm-1'))

		selectEntitiesByName(world, ['arm-1'])
		armEntity.remove(traits.Selected)
		armEntity.set(traits.Name, 'arm-1')

		expect(armEntity.has(traits.Selected)).toBe(false)
	})

	it('releases its listeners once every name has resolved', () => {
		world = createWorld()
		world.spawn(traits.Name('arm-1'))

		selectEntitiesByName(world, ['arm-1'])
		const laterEntity = world.spawn(traits.Name('arm-1'))

		expect(laterEntity.has(traits.Selected)).toBe(false)
	})

	it('selects nothing later when release is called before the name appears', () => {
		world = createWorld()

		const release = selectEntitiesByName(world, ['arm-1'])
		release()
		const laterEntity = world.spawn(traits.Name('arm-1'))

		expect(laterEntity.has(traits.Selected)).toBe(false)
	})
})
