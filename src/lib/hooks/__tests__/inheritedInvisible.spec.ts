import { createWorld, type World } from 'koota'
import { afterEach, describe, expect, it } from 'vitest'

import { relations, traits } from '#lib/ecs/index.js'

import { addInheritedInvisibleListeners } from '../useInheritedInvisible.svelte'

describe('inheritedInvisible system', () => {
	let world: World
	let unsub: (() => void) | undefined
	afterEach(() => {
		unsub?.()
		unsub = undefined
		world?.destroy()
	})

	const tick = () => Promise.resolve()

	it('marks an entity with Invisible as InheritedInvisible', async () => {
		world = createWorld()
		unsub = addInheritedInvisibleListeners(world)

		const entity = world.spawn(traits.Invisible)
		await tick()

		expect(entity.has(traits.InheritedInvisible)).toBe(true)
	})

	it('propagates Invisible from parent to descendants', async () => {
		world = createWorld()
		unsub = addInheritedInvisibleListeners(world)

		const parent = world.spawn(traits.Invisible)
		const child = world.spawn(relations.ChildOf(parent))
		const grandchild = world.spawn(relations.ChildOf(child))
		await tick()

		expect(child.has(traits.InheritedInvisible)).toBe(true)
		expect(grandchild.has(traits.InheritedInvisible)).toBe(true)
	})

	it('clears InheritedInvisible from descendants when ancestor unhides', async () => {
		world = createWorld()
		unsub = addInheritedInvisibleListeners(world)

		const parent = world.spawn(traits.Invisible)
		const child = world.spawn(relations.ChildOf(parent))
		await tick()
		expect(child.has(traits.InheritedInvisible)).toBe(true)

		parent.remove(traits.Invisible)
		await tick()

		expect(parent.has(traits.InheritedInvisible)).toBe(false)
		expect(child.has(traits.InheritedInvisible)).toBe(false)
	})

	it('keeps a descendant marked when the descendant has its own Invisible', async () => {
		world = createWorld()
		unsub = addInheritedInvisibleListeners(world)

		const parent = world.spawn(traits.Invisible)
		const child = world.spawn(relations.ChildOf(parent), traits.Invisible)
		await tick()

		parent.remove(traits.Invisible)
		await tick()

		expect(parent.has(traits.InheritedInvisible)).toBe(false)
		expect(child.has(traits.InheritedInvisible)).toBe(true)
	})

	it('updates when a child is reparented under an invisible parent', async () => {
		world = createWorld()
		unsub = addInheritedInvisibleListeners(world)

		const hiddenParent = world.spawn(traits.Invisible)
		const visibleParent = world.spawn()
		const child = world.spawn(relations.ChildOf(visibleParent))
		await tick()
		expect(child.has(traits.InheritedInvisible)).toBe(false)

		child.add(relations.ChildOf(hiddenParent))
		await tick()

		expect(child.has(traits.InheritedInvisible)).toBe(true)
	})

	it('clears when a child is reparented away from an invisible parent', async () => {
		world = createWorld()
		unsub = addInheritedInvisibleListeners(world)

		const hiddenParent = world.spawn(traits.Invisible)
		const visibleParent = world.spawn()
		const child = world.spawn(relations.ChildOf(hiddenParent))
		await tick()
		expect(child.has(traits.InheritedInvisible)).toBe(true)

		child.add(relations.ChildOf(visibleParent))
		await tick()

		expect(child.has(traits.InheritedInvisible)).toBe(false)
	})

	it('coalesces multiple changes into a single flush', async () => {
		world = createWorld()
		unsub = addInheritedInvisibleListeners(world)

		const parent = world.spawn()
		const child = world.spawn(relations.ChildOf(parent))

		parent.add(traits.Invisible)
		parent.remove(traits.Invisible)
		parent.add(traits.Invisible)
		await tick()

		expect(child.has(traits.InheritedInvisible)).toBe(true)
	})

	it('backfills entities that already have Invisible at install time', async () => {
		world = createWorld()
		const parent = world.spawn(traits.Invisible)
		const child = world.spawn(relations.ChildOf(parent))

		unsub = addInheritedInvisibleListeners(world)
		await tick()

		expect(parent.has(traits.InheritedInvisible)).toBe(true)
		expect(child.has(traits.InheritedInvisible)).toBe(true)
	})
})
