import { createWorld } from 'koota'
import { beforeEach, describe, expect, it } from 'vitest'

import type { ResourceAppearance } from '$lib/resourceAppearance'

import { applyConfigAppearance } from '../applyConfigAppearance'
import * as traits from '../traits'

const world = createWorld()

beforeEach(() => {
	world.reset()
})

const spawnFrame = (name: string) =>
	world.spawn(traits.Name(name), traits.FramesAPI, traits.ShowAxesHelper, traits.Opacity(0.5))

const savedFor = (own: ResourceAppearance, frames: Record<string, ResourceAppearance> = {}) =>
	new Map([['cage', { own, frames: new Map(Object.entries(frames)) }]])

describe('applyConfigAppearance on a resource frame', () => {
	it('hides a resource saved as invisible', () => {
		const cage = spawnFrame('cage')

		applyConfigAppearance(cage, savedFor({ invisible: true }))

		expect(cage.has(traits.Invisible)).toBe(true)
	})

	it('turns off the axes helper of a resource saved without one', () => {
		const cage = spawnFrame('cage')

		applyConfigAppearance(cage, savedFor({ show_axes_helper: false }))

		expect(cage.has(traits.ShowAxesHelper)).toBe(false)
	})

	it('keeps an edit made in the scene while the config is unchanged', () => {
		const cage = spawnFrame('cage')
		applyConfigAppearance(cage, savedFor({ invisible: true }))
		cage.remove(traits.Invisible)

		applyConfigAppearance(cage, savedFor({ invisible: true }))

		expect(cage.has(traits.Invisible)).toBe(false)
	})

	it('applies the config again once it changes, field by field', () => {
		const cage = spawnFrame('cage')
		applyConfigAppearance(cage, savedFor({ invisible: true }))
		cage.remove(traits.Invisible)

		applyConfigAppearance(cage, savedFor({ invisible: true, opacity: 0.3 }))

		expect(cage.has(traits.Invisible)).toBe(false)
		expect(cage.get(traits.OpacityOverride)).toBe(0.3)
	})

	it('puts the defaults back when the saved keys are removed', () => {
		const cage = spawnFrame('cage')
		applyConfigAppearance(
			cage,
			savedFor({ invisible: true, show_axes_helper: false, opacity: 0.2 })
		)

		applyConfigAppearance(cage, savedFor({}))

		expect(cage.has(traits.Invisible)).toBe(false)
		expect(cage.has(traits.ShowAxesHelper)).toBe(true)
		expect(cage.get(traits.OpacityOverride)).toBe(0.5)
	})

	it('touches nothing on a frame whose resource saves no appearance', () => {
		const arm = world.spawn(traits.Name('arm'), traits.FramesAPI, traits.Invisible)

		applyConfigAppearance(arm, savedFor({ invisible: false }))

		expect(arm.has(traits.Invisible)).toBe(true)
		expect(arm.has(traits.ShowAxesHelper)).toBe(false)
		expect(arm.has(traits.OpacityOverride)).toBe(false)
	})
})

describe('applyConfigAppearance on a frame inside a resource', () => {
	it('follows the resource opacity and axes helper', () => {
		const post = spawnFrame('cage:post')

		applyConfigAppearance(post, savedFor({ opacity: 0.2, show_axes_helper: false }))

		expect(post.get(traits.OpacityOverride)).toBe(0.2)
		expect(post.has(traits.ShowAxesHelper)).toBe(false)
	})

	it('takes its own saved values over the resource ones', () => {
		const post = spawnFrame('cage:post')

		applyConfigAppearance(
			post,
			savedFor(
				{ opacity: 0.2, show_axes_helper: false },
				{ post: { opacity: 0.9, show_axes_helper: true } }
			)
		)

		expect(post.get(traits.OpacityOverride)).toBe(0.9)
		expect(post.has(traits.ShowAxesHelper)).toBe(true)
	})

	it('leaves a sibling that saves nothing on the resource values', () => {
		const wall = spawnFrame('cage:wall')

		applyConfigAppearance(wall, savedFor({ opacity: 0.2 }, { post: { opacity: 0.9 } }))

		expect(wall.get(traits.OpacityOverride)).toBe(0.2)
	})

	it('is not hidden by the resource being saved as invisible, which hides it through its parent', () => {
		const post = spawnFrame('cage:post')

		applyConfigAppearance(post, savedFor({ invisible: true }))

		expect(post.has(traits.Invisible)).toBe(false)
	})

	it('hides itself when it saves its own invisible', () => {
		const post = spawnFrame('cage:post')

		applyConfigAppearance(post, savedFor({}, { post: { invisible: true } }))

		expect(post.has(traits.Invisible)).toBe(true)
	})

	it('follows a resource change while it saves nothing of its own', () => {
		const post = spawnFrame('cage:post')
		applyConfigAppearance(post, savedFor({ opacity: 0.2 }))

		applyConfigAppearance(post, savedFor({ opacity: 0.6 }))

		expect(post.get(traits.OpacityOverride)).toBe(0.6)
	})
})
