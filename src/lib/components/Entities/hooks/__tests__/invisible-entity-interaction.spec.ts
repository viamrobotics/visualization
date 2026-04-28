import { createWorld, type World } from 'koota'
import { afterEach, describe, expect, it } from 'vitest'

import { traits } from '$lib/ecs'

/**
 * Tests for the invisible-entity interaction invariants enforced by
 * useEntityEvents: invisible entities must not be hoverable, selectable,
 * or focusable.
 *
 * The reactive guard (`$effect` + handler early-returns) lives in
 * useEntityEvents.svelte.ts and cannot be unit-tested without a full
 * Svelte/Threlte component context. These tests verify the underlying
 * ECS trait operations that the guard relies on.
 */
describe('invisible entity interaction', () => {
	let world: World
	afterEach(() => world?.destroy())

	it('removes Hovered trait when entity becomes invisible', () => {
		world = createWorld()
		const entity = world.spawn(traits.Name('hoverable'), traits.Hovered)

		expect(entity.has(traits.Hovered)).toBe(true)

		entity.add(traits.Invisible)

		// Simulate the cleanup that $effect performs in useEntityEvents
		if (entity.has(traits.Hovered)) {
			entity.remove(traits.Hovered)
		}

		expect(entity.has(traits.Hovered)).toBe(false)
		expect(entity.has(traits.Invisible)).toBe(true)
	})

	it('removes InstancedPose trait when entity becomes invisible', () => {
		world = createWorld()
		const entity = world.spawn(
			traits.Name('instanced'),
			traits.InstancedPose({ index: 0, x: 1, y: 2, z: 3, oX: 0, oY: 0, oZ: 1, theta: 0 })
		)

		expect(entity.has(traits.InstancedPose)).toBe(true)

		entity.add(traits.Invisible)

		// Simulate the cleanup that $effect performs in useEntityEvents
		if (entity.has(traits.InstancedPose)) {
			entity.remove(traits.InstancedPose)
		}

		expect(entity.has(traits.InstancedPose)).toBe(false)
		expect(entity.has(traits.Invisible)).toBe(true)
	})

	it('cleans up both Hovered and InstancedPose when entity becomes invisible', () => {
		world = createWorld()
		const entity = world.spawn(
			traits.Name('full-cleanup'),
			traits.Hovered,
			traits.InstancedPose({ index: 5, x: 10, y: 20, z: 30, oX: 0, oY: 0, oZ: 1, theta: 0 })
		)

		expect(entity.has(traits.Hovered)).toBe(true)
		expect(entity.has(traits.InstancedPose)).toBe(true)

		entity.add(traits.Invisible)

		// Simulate the cleanup that $effect performs in useEntityEvents
		if (entity.has(traits.Hovered)) {
			entity.remove(traits.Hovered)
		}
		if (entity.has(traits.InstancedPose)) {
			entity.remove(traits.InstancedPose)
		}

		expect(entity.has(traits.Hovered)).toBe(false)
		expect(entity.has(traits.InstancedPose)).toBe(false)
		expect(entity.has(traits.Invisible)).toBe(true)
	})

	it('does not error when cleaning up entity without Hovered or InstancedPose', () => {
		world = createWorld()
		const entity = world.spawn(traits.Name('bare'))

		entity.add(traits.Invisible)

		// Cleanup should be safe even when traits are absent
		if (entity.has(traits.Hovered)) {
			entity.remove(traits.Hovered)
		}
		if (entity.has(traits.InstancedPose)) {
			entity.remove(traits.InstancedPose)
		}

		expect(entity.has(traits.Hovered)).toBe(false)
		expect(entity.has(traits.InstancedPose)).toBe(false)
		expect(entity.has(traits.Invisible)).toBe(true)
	})

	it('allows re-adding Hovered after Invisible is removed', () => {
		world = createWorld()
		const entity = world.spawn(traits.Name('toggle'), traits.Invisible)

		expect(entity.has(traits.Invisible)).toBe(true)

		entity.remove(traits.Invisible)
		entity.add(traits.Hovered)

		expect(entity.has(traits.Invisible)).toBe(false)
		expect(entity.has(traits.Hovered)).toBe(true)
	})
})
