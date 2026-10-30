import type { World } from 'koota'

import { render } from '@testing-library/svelte'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { traits } from '$lib/ecs'
import { SubEntityLink } from '$lib/ecs/relations'

import {
	BOX,
	createFakeWorldStateStore,
	poseUpdate,
	removal,
	SPHERE,
	storedChunkedCloud,
	storedPointCloud,
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

const drawnEntity = (world: World, name: string) =>
	world.query(traits.WorldStateStoreAPI).find((entity) => entity.get(traits.Name) === name)

const drawnX = (world: World, name: string) =>
	drawnEntity(world, name)?.get(traits.Matrix)?.elements[12]

const drawnPointCount = (world: World, name: string) =>
	drawnEntity(world, name)?.get(traits.BufferGeometry)?.getAttribute('position')?.count

const isLinked = (world: World, from: string, to: string) => {
	const target = drawnEntity(world, to)
	return target !== undefined && (drawnEntity(world, from)?.has(SubEntityLink(target)) ?? false)
}

const FRAME_UUID = '00000000-0000-4000-8000-00000000000a'
const CLOUD_UUID = '00000000-0000-4000-8000-00000000000b'

const nextFrame = () => new Promise((resolve) => requestAnimationFrame(resolve))

const settleSnapshot = () => new Promise((resolve) => setTimeout(resolve))

const mounted: Array<{ world: World; unmount: () => void }> = []

/**
 * Koota hands out 16 world ids and then throws `Too many worlds created`, and unmounting the
 * host does not release one. The host unmounts first, so its teardown runs against a live world.
 */
afterEach(() => {
	for (const { world, unmount } of mounted.splice(0)) {
		unmount()
		world.destroy()
	}
})

const mountStore = async (expectedNames: string[]) => {
	let world: World | undefined
	const { unmount } = render(WorldStateHost, { onReady: (ready: World) => (world = ready) })
	if (!world) throw new Error('WorldStateHost never called onReady')
	mounted.push({ world, unmount })
	await expect.poll(() => drawnNames(world!)).toEqual(expectedNames)
	return world
}

describe('WorldState, when the store is rebuilt', () => {
	it('destroys an entity the new instance does not hold', async () => {
		const store = createFakeWorldStateStore()
		store.hold([storedTransform('frame-a'), storedTransform('frame-b')])
		const world = await mountStore(['frame-a', 'frame-b'])
		store.hold([storedTransform('frame-a')])

		store.rebuild()

		await expect.poll(() => drawnNames(world)).toEqual(['frame-a'])
	})

	it('redraws an entity the new instance holds, though the old stream removed it', async () => {
		const store = createFakeWorldStateStore()
		store.hold([storedTransform('frame-a'), storedTransform('frame-b')], [removal('frame-b')])
		const world = await mountStore(['frame-a'])
		store.hold([storedTransform('frame-a'), storedTransform('frame-b')])

		store.rebuild()

		await expect.poll(() => drawnNames(world)).toEqual(['frame-a', 'frame-b'])
	})

	it('moves a frame the new instance holds at a new pose', async () => {
		const store = createFakeWorldStateStore()
		store.hold([storedTransform('frame-a')])
		const world = await mountStore(['frame-a'])
		store.hold([storedTransform('frame-a', { xMillimeters: 100 })])

		store.rebuild()

		await expect.poll(() => drawnX(world, 'frame-a')).toBeCloseTo(0.1)
	})

	it('keeps a frame as the same entity, so its selection survives', async () => {
		const store = createFakeWorldStateStore()
		store.hold([storedTransform('frame-a')])
		const world = await mountStore(['frame-a'])
		const before = drawnEntity(world, 'frame-a')
		store.hold([storedTransform('frame-a', { xMillimeters: 100 })])

		store.rebuild()
		await expect.poll(() => drawnX(world, 'frame-a')).toBeCloseTo(0.1)

		expect(drawnEntity(world, 'frame-a')).toBe(before)
	})

	it('shows the points the new instance holds for a cloud', async () => {
		const store = createFakeWorldStateStore()
		store.hold([storedPointCloud('cloud-a', 3)])
		const world = await mountStore(['cloud-a'])
		await expect.poll(() => drawnPointCount(world, 'cloud-a')).toBe(3)
		store.hold([storedPointCloud('cloud-a', 5)])

		store.rebuild()

		await expect.poll(() => drawnPointCount(world, 'cloud-a')).toBe(5)
	})

	it('loads every chunk of a cloud the new instance holds, not only the first', async () => {
		const store = createFakeWorldStateStore()
		store.hold([storedChunkedCloud('cloud-a', 2, 4)])
		const world = await mountStore(['cloud-a'])
		await expect.poll(() => drawnPointCount(world, 'cloud-a')).toBe(4)
		store.hold([storedChunkedCloud('cloud-a', 2, 6)])

		store.rebuild()

		await expect.poll(() => drawnPointCount(world, 'cloud-a')).toBe(6)
	})

	it('keeps a link to a cloud it respawns', async () => {
		const store = createFakeWorldStateStore()
		const holdings = () => [
			storedTransform(FRAME_UUID, { name: 'frame-a', linkTo: CLOUD_UUID }),
			storedPointCloud(CLOUD_UUID, 3, 'cloud-b'),
		]
		store.hold(holdings())
		const world = await mountStore(['cloud-b', 'frame-a'])
		await expect.poll(() => isLinked(world, 'frame-a', 'cloud-b')).toBe(true)
		store.hold(holdings())

		store.rebuild()
		await settleSnapshot()

		expect(isLinked(world, 'frame-a', 'cloud-b')).toBe(true)
	})

	it('renames an entity the new instance holds under a new name', async () => {
		const store = createFakeWorldStateStore()
		store.hold([storedTransform('uuid-1', { name: 'frame-a' })])
		const world = await mountStore(['frame-a'])
		store.hold([storedTransform('uuid-1', { name: 'frame-z' })])

		store.rebuild()

		await expect.poll(() => drawnNames(world)).toEqual(['frame-z'])
	})

	it('removes geometry the new instance no longer holds', async () => {
		const store = createFakeWorldStateStore()
		store.hold([storedTransform('frame-a', { geometryType: BOX })])
		const world = await mountStore(['frame-a'])
		store.hold([storedTransform('frame-a', { xMillimeters: 100 })])

		store.rebuild()
		await expect.poll(() => drawnX(world, 'frame-a')).toBeCloseTo(0.1)

		expect(drawnEntity(world, 'frame-a')?.has(traits.Box)).toBe(false)
	})

	it('draws the snapshot geometry when a pose-only update lands while it loads', async () => {
		const store = createFakeWorldStateStore()
		store.hold([storedTransform('frame-a', { geometryType: BOX })])
		const world = await mountStore(['frame-a'])
		store.hold([storedTransform('frame-a', { geometryType: SPHERE })], [poseUpdate('frame-a', 100)])
		const release = store.gateTransforms()
		store.rebuild()
		await store.eventsDelivered()
		await nextFrame()

		release()

		await expect.poll(() => drawnEntity(world, 'frame-a')?.has(traits.Sphere)).toBe(true)
	})

	it('keeps a pose the stream reported while the snapshot loaded', async () => {
		const store = createFakeWorldStateStore()
		store.hold([storedTransform('frame-a')])
		const world = await mountStore(['frame-a'])
		store.hold([storedTransform('frame-a')], [poseUpdate('frame-a', 100)])
		const release = store.gateTransforms()
		store.rebuild()
		await store.eventsDelivered()
		await nextFrame()

		release()
		await settleSnapshot()
		await nextFrame()

		expect(drawnX(world, 'frame-a')).toBeCloseTo(0.1)
	})

	it('is detected from a closed stream when it happens before the first machine status', async () => {
		const store = createFakeWorldStateStore('')
		store.hold([storedTransform('frame-a'), storedTransform('frame-b')])
		const world = await mountStore(['frame-a', 'frame-b'])
		store.hold([storedTransform('frame-a')])
		await store.closeStream()

		store.reportGeneration('1')

		await expect.poll(() => drawnNames(world)).toEqual(['frame-a'])
	})
})

describe('WorldState, when the store is not rebuilt', () => {
	it('fetches every transform but its drawn clouds on a reconnect', async () => {
		const store = createFakeWorldStateStore()
		store.hold([storedPointCloud('cloud-a', 3), storedTransform('frame-b')])
		const world = await mountStore(['cloud-a', 'frame-b'])
		store.forgetFetches()
		store.hold([
			storedPointCloud('cloud-a', 1),
			storedTransform('frame-b'),
			storedTransform('frame-c'),
		])

		store.reconnect()
		await expect.poll(() => drawnNames(world)).toEqual(['cloud-a', 'frame-b', 'frame-c'])

		expect(store.fetchedUUIDs()).toEqual(['frame-b', 'frame-c'])
	})

	it('moves a frame that moved while the connection was down', async () => {
		const store = createFakeWorldStateStore()
		store.hold([storedTransform('frame-a')])
		const world = await mountStore(['frame-a'])
		store.hold([storedTransform('frame-a', { xMillimeters: 100 })])

		store.reconnect()

		await expect.poll(() => drawnX(world, 'frame-a')).toBeCloseTo(0.1)
	})

	it('reopens a stream the server ended, and draws what changed meanwhile', async () => {
		const store = createFakeWorldStateStore()
		store.hold([storedTransform('frame-a')])
		const world = await mountStore(['frame-a'])
		store.hold([storedTransform('frame-a'), storedTransform('frame-b')])

		await store.closeStream()

		await expect.poll(() => drawnNames(world), { timeout: 3000 }).toEqual(['frame-a', 'frame-b'])
	})

	it('lists the store once when the first machine status arrives after mount', async () => {
		const store = createFakeWorldStateStore('')
		store.hold([storedTransform('frame-a')])
		await mountStore(['frame-a'])

		store.reportGeneration('1')

		expect(store.snapshotsTaken()).toBe(1)
	})

	it('lists the store once when its status drops out and returns', async () => {
		const store = createFakeWorldStateStore()
		store.hold([storedTransform('frame-a')])
		await mountStore(['frame-a'])
		store.reportGeneration('')

		store.reportGeneration('1')

		expect(store.snapshotsTaken()).toBe(1)
	})
})
