import { createWorld, type World } from 'koota'
import { afterEach, describe, expect, it } from 'vitest'

import { DEFAULT_GEOMETRY_OPACITY, resolveOpacity } from '../opacity.svelte'
import { Opacity, OpacityOverride } from '../traits'

describe('resolveOpacity', () => {
	let world: World

	afterEach(() => {
		world?.destroy()
	})

	it('falls back to the collider default when the entity carries neither trait', () => {
		world = createWorld()

		expect(resolveOpacity(world.spawn())).toBe(DEFAULT_GEOMETRY_OPACITY)
	})

	it('reads the source opacity when the user has not overridden it', () => {
		world = createWorld()

		expect(resolveOpacity(world.spawn(Opacity(0.25)))).toBe(0.25)
	})

	it('ranks the user override above the source opacity', () => {
		world = createWorld()

		expect(resolveOpacity(world.spawn(Opacity(0.25), OpacityOverride(0.8)))).toBe(0.8)
	})

	it('honours an override of 1 over a translucent source', () => {
		world = createWorld()

		expect(resolveOpacity(world.spawn(Opacity(0.25), OpacityOverride(1)))).toBe(1)
	})

	it('keeps the override when a reconcile rewrites the source opacity', () => {
		world = createWorld()
		const entity = world.spawn(Opacity(0.25), OpacityOverride(1))

		entity.set(Opacity, 0.4)

		expect(resolveOpacity(entity)).toBe(1)
	})
})
