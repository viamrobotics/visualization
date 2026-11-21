import { createWorld, type World } from 'koota'
import { afterEach, describe, expect, it } from 'vitest'

import { resolveOpacity } from '../opacity.svelte'
import { Dimmed, Opacity, OpacityOverride } from '../traits'

describe('resolveOpacity', () => {
	let world: World

	afterEach(() => {
		world?.destroy()
	})

	it('renders opaque when the entity carries neither trait', () => {
		world = createWorld()

		expect(resolveOpacity(world.spawn())).toBe(1)
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

	it('halves a dimmed entity with no traits to 0.5', () => {
		world = createWorld()

		expect(resolveOpacity(world.spawn(Dimmed))).toBe(0.5)
	})

	it('halves the opacity of a dimmed translucent entity', () => {
		world = createWorld()

		expect(resolveOpacity(world.spawn(Dimmed, Opacity(0.25)))).toBe(0.125)
	})

	it('halves a dimmed entity under an override of 1 to 0.5', () => {
		world = createWorld()

		expect(resolveOpacity(world.spawn(Dimmed, OpacityOverride(1)))).toBe(0.5)
	})

	it('restores the undimmed opacity once Dimmed is removed', () => {
		world = createWorld()
		const entity = world.spawn(Dimmed, OpacityOverride(1))

		entity.remove(Dimmed)

		expect(resolveOpacity(entity)).toBe(1)
	})
})
