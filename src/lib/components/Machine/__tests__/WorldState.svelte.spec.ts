import type { World } from 'koota'

import { render } from '@testing-library/svelte'
import { describe, expect, it, vi } from 'vitest'

import { traits } from '$lib/ecs'

import {
	createFakeWorldStateStore,
	removal,
	storedTransform,
} from './__fixtures__/fakeWorldStateStore.svelte'
import WorldStateHost from './__fixtures__/WorldStateHost.svelte'

vi.mock('@viamrobotics/svelte-sdk', () => ({
	createResourceClient: vi.fn(),
	useResourceGeneration: vi.fn(),
}))

const drawnNames = (world: World) =>
	world
		.query(traits.WorldStateStoreAPI)
		.map((entity) => entity.get(traits.Name))
		.toSorted()

const drawnX = (world: World, name: string) =>
	world
		.query(traits.WorldStateStoreAPI)
		.find((entity) => entity.get(traits.Name) === name)
		?.get(traits.Matrix)?.elements[12]

const mountStore = async (expectedNames: string[]) => {
	let world: World | undefined
	render(WorldStateHost, { onReady: (ready: World) => (world = ready) })
	await expect.poll(() => drawnNames(world!)).toEqual(expectedNames)
	return world!
}

describe('WorldState', () => {
	it('destroys an entity the store dropped while it was being rebuilt', async () => {
		const store = createFakeWorldStateStore()
		store.hold([storedTransform('frame-a'), storedTransform('frame-b')])
		const world = await mountStore(['frame-a', 'frame-b'])
		store.hold([storedTransform('frame-a')])

		store.rebuild()

		await expect.poll(() => drawnNames(world)).toEqual(['frame-a'])
	})

	it('redraws an entity the store holds again after a rebuild, though a stream removed it', async () => {
		const store = createFakeWorldStateStore()
		store.hold([storedTransform('frame-a'), storedTransform('frame-b')], [removal('frame-b')])
		const world = await mountStore(['frame-a'])
		store.hold([storedTransform('frame-a'), storedTransform('frame-b')])

		store.rebuild()

		await expect.poll(() => drawnNames(world)).toEqual(['frame-a', 'frame-b'])
	})

	it('moves an entity the rebuilt store holds at a new pose', async () => {
		const store = createFakeWorldStateStore()
		store.hold([storedTransform('frame-a', 0)])
		const world = await mountStore(['frame-a'])
		store.hold([storedTransform('frame-a', 100)])

		store.rebuild()

		await expect.poll(() => drawnX(world, 'frame-a')).toBeCloseTo(0.1)
	})
})
