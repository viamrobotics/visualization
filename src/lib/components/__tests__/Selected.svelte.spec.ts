import { render } from '@testing-library/svelte'
import { useTask, useThrelte } from '@threlte/core/webgpu'
import { createWorld, type Entity, type World } from 'koota'
import { flushSync } from 'svelte'
import { Matrix4 } from 'three'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { traits } from '$lib/ecs'
import { WORLD_CONTEXT_KEY } from '$lib/ecs/useWorld'

import Selected from '../Selected.svelte'

const mountSelected = (world: World) => {
	render(Selected, { context: new Map([[WORLD_CONTEXT_KEY, world]]) })

	const task = vi
		.mocked(useTask)
		.mock.calls[0].find((argument): argument is (delta: number) => void => {
			return typeof argument === 'function'
		})
	const runFrame = () => task?.(0)
	const { invalidate } = vi.mocked(useThrelte).mock.results[0].value as {
		invalidate: ReturnType<typeof vi.fn>
	}

	return { runFrame, invalidate }
}

const moveTo = (entity: Entity, x: number) => {
	const world = entity.get(traits.WorldMatrix)
	world?.makeTranslation(x, 0, 0)
	entity.changed(traits.WorldMatrix)
}

describe('Selected', () => {
	let world: World

	beforeEach(() => {
		world = createWorld()
	})

	afterEach(() => {
		world.destroy()
	})

	it('renders once for a selected box that stays still', () => {
		world.spawn(traits.Selected, traits.Box(), traits.WorldMatrix(new Matrix4()))
		const { runFrame, invalidate } = mountSelected(world)

		runFrame()
		runFrame()
		runFrame()

		expect(invalidate).toHaveBeenCalledTimes(1)
	})

	it('renders again when a selected box moves', () => {
		const entity = world.spawn(traits.Selected, traits.Box(), traits.WorldMatrix(new Matrix4()))
		const { runFrame, invalidate } = mountSelected(world)
		runFrame()

		moveTo(entity, 1)
		runFrame()

		expect(invalidate).toHaveBeenCalledTimes(2)
	})

	it('renders when a selected frame is deselected, clearing its axes', () => {
		const entity = world.spawn(traits.Selected, traits.WorldMatrix(new Matrix4()))
		const { runFrame, invalidate } = mountSelected(world)
		runFrame()

		entity.remove(traits.Selected)
		flushSync()

		expect(invalidate).toHaveBeenCalledTimes(2)
	})
})
