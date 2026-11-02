import type { World } from 'koota'

import { Code, ConnectError } from '@connectrpc/connect'
import { render } from '@testing-library/svelte'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { useRelationships } from '$lib/hooks/useRelationships.svelte'

import { hierarchy, traits } from '$lib/ecs'
import { ChildOf, SubEntityLink } from '$lib/ecs/relations'

import { createWorldStateSync, type WorldStateTiming } from '../worldStateSync'
import {
	addition,
	BOX,
	createFakeWorldStateStore,
	pointsUpdate,
	poseUpdate,
	removal,
	storedChunkedCloud,
	storedPointCloud,
	storedTransform,
} from './__fixtures__/fakeWorldStateStore'
import SceneContextHost from './__fixtures__/SceneContextHost.svelte'

type FakeStore = ReturnType<typeof createFakeWorldStateStore>

const TIMING: WorldStateTiming = {
	readTimeoutMs: 10_000,
	streamHealthyMs: 30_000,
	retryBaseDelayMs: 20,
	retryMaxDelayMs: 100,
}

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

/** One macrotask: long enough for a frame flush, or a snapshot whose requests already resolved. */
const settle = () => new Promise((resolve) => setTimeout(resolve))

const mounted: Array<{ world: World; unmount: () => void; dispose: () => void }> = []

/**
 * Koota hands out 16 world ids and then throws `Too many worlds created`, and unmounting the
 * host does not release one. The sync goes first, so its teardown runs against a live world.
 */
afterEach(() => {
	for (const { world, unmount, dispose } of mounted.splice(0)) {
		dispose()
		unmount()
		world.destroy()
	}
})

/**
 * Starts a sync reading `store`, and waits for the snapshot to draw `expectedNames`.
 *
 * @param initialGeneration What the machine status reports at mount. Empty means none yet.
 */
const startSync = async (store: FakeStore, expectedNames: string[], initialGeneration = '1') => {
	let context: { world: World; relationships: ReturnType<typeof useRelationships> } | undefined
	const { unmount } = render(SceneContextHost, { onReady: (ready) => (context = ready) })
	if (!context) throw new Error('SceneContextHost never called onReady')
	const { world } = context

	const logged: string[] = []
	// Frames run on the next macrotask, unless a test pauses them to run one at a moment it picks.
	let isFramesPaused = false
	const pausedFrames = new Set<() => void>()
	const sync = createWorldStateSync({
		world,
		relationships: context.relationships,
		logs: {
			add: (message: string) => {
				logged.push(message)
			},
		} as Parameters<typeof createWorldStateSync>[0]['logs'],
		invalidate: () => {},
		requestFrame: (callback) => {
			if (isFramesPaused) {
				pausedFrames.add(callback)
				return () => pausedFrames.delete(callback)
			}
			const id = setTimeout(callback)
			return () => clearTimeout(id)
		},
		timing: TIMING,
	})
	mounted.push({ world, unmount, dispose: sync.dispose })

	let client = store.client()
	let generation = initialGeneration
	sync.update({ client, generation })
	await expect.poll(() => drawnNames(world)).toEqual(expectedNames)

	return {
		world,
		/** Every message the sync logged, in order. */
		logged,
		dispose: sync.dispose,
		/** Replaces the store's instance, then reports the new generation the status would. */
		rebuild: () => {
			store.replaceInstance()
			generation = String(Number(generation) + 1)
			sync.update({ client, generation })
		},
		/** Drops the connection, as `canQuery` turning false does. */
		disconnect: () => {
			sync.update({ client: undefined, generation })
		},
		/** Drops and restores the connection to the same instance. */
		reconnect: () => {
			client = store.reconnect()
			sync.update({ client, generation })
		},
		/** Reports `value` as the store's generation, as the status poll would. */
		reportGeneration: (value: string) => {
			generation = value
			sync.update({ client, generation })
		},
		/** Holds every frame requested from now until `resumeFrames`. */
		pauseFrames: () => {
			isFramesPaused = true
		},
		/** Runs the frames held so far, and lets later ones run on their own again. */
		resumeFrames: () => {
			isFramesPaused = false
			const frames = [...pausedFrames]
			pausedFrames.clear()
			for (const frame of frames) frame()
		},
	}
}

describe('createWorldStateSync, when the store is rebuilt', () => {
	it('destroys an entity the new instance does not hold', async () => {
		const store = createFakeWorldStateStore()
		store.hold([storedTransform('frame-a'), storedTransform('frame-b')])
		const { world, rebuild } = await startSync(store, ['frame-a', 'frame-b'])
		store.hold([storedTransform('frame-a')])

		rebuild()

		await expect.poll(() => drawnNames(world)).toEqual(['frame-a'])
	})

	it('redraws an entity the new instance holds, though the old stream removed it', async () => {
		const store = createFakeWorldStateStore()
		store.hold([storedTransform('frame-a'), storedTransform('frame-b')], [removal('frame-b')])
		const { world, rebuild } = await startSync(store, ['frame-a'])
		store.hold([storedTransform('frame-a'), storedTransform('frame-b')])

		rebuild()

		await expect.poll(() => drawnNames(world)).toEqual(['frame-a', 'frame-b'])
	})

	it('moves a frame as the same entity, so its selection survives', async () => {
		const store = createFakeWorldStateStore()
		store.hold([storedTransform('frame-a')])
		const { world, rebuild } = await startSync(store, ['frame-a'])
		const before = drawnEntity(world, 'frame-a')
		store.hold([storedTransform('frame-a', { xMillimeters: 100 })])

		rebuild()
		await expect.poll(() => drawnX(world, 'frame-a')).toBeCloseTo(0.1)

		expect(drawnEntity(world, 'frame-a')).toBe(before)
	})

	it('loads every chunk of a cloud the new instance holds, not only the first', async () => {
		const store = createFakeWorldStateStore()
		store.hold([storedChunkedCloud('cloud-a', 2, 4)])
		const { world, rebuild } = await startSync(store, ['cloud-a'])
		await expect.poll(() => drawnPointCount(world, 'cloud-a')).toBe(4)
		store.hold([storedChunkedCloud('cloud-a', 2, 6)])

		rebuild()

		await expect.poll(() => drawnPointCount(world, 'cloud-a')).toBe(6)
	})

	it('stays a rebuild when a reconnect interrupts its snapshot', async () => {
		const store = createFakeWorldStateStore()
		store.hold([storedPointCloud('cloud-a', 3)])
		const { world, rebuild, reconnect } = await startSync(store, ['cloud-a'])
		await expect.poll(() => drawnPointCount(world, 'cloud-a')).toBe(3)
		store.hold([storedPointCloud('cloud-a', 5)])
		const release = store.gateTransforms()
		rebuild()
		reconnect()

		release()

		await expect.poll(() => drawnPointCount(world, 'cloud-a')).toBe(5)
	})

	it('retries a rebuild whose snapshot failed', async () => {
		const store = createFakeWorldStateStore()
		store.hold([storedPointCloud('cloud-a', 3)])
		const { world, rebuild } = await startSync(store, ['cloud-a'])
		await expect.poll(() => drawnPointCount(world, 'cloud-a')).toBe(3)
		store.hold([storedPointCloud('cloud-a', 5)])
		store.failNextSnapshot()

		rebuild()

		await expect.poll(() => drawnPointCount(world, 'cloud-a')).toBe(5)
	})

	it('brings back a cloud whose fetch failed, with the new instance’s points', async () => {
		const store = createFakeWorldStateStore()
		store.hold([storedPointCloud('cloud-a', 3)])
		const { world, rebuild } = await startSync(store, ['cloud-a'])
		await expect.poll(() => drawnPointCount(world, 'cloud-a')).toBe(3)
		store.hold([storedPointCloud('cloud-a', 5)])
		store.failNextFetch('cloud-a')

		rebuild()

		await expect.poll(() => drawnPointCount(world, 'cloud-a')).toBe(5)
	})

	it('keeps a link to a cloud it respawns', async () => {
		const store = createFakeWorldStateStore()
		const holdings = () => [
			storedTransform(FRAME_UUID, { name: 'frame-a', linkTo: CLOUD_UUID }),
			storedPointCloud(CLOUD_UUID, 3, 'cloud-b'),
		]
		store.hold(holdings())
		const { world, rebuild } = await startSync(store, ['cloud-b', 'frame-a'])
		await expect.poll(() => isLinked(world, 'frame-a', 'cloud-b')).toBe(true)
		store.hold(holdings())

		rebuild()
		await settle()

		expect(isLinked(world, 'frame-a', 'cloud-b')).toBe(true)
	})

	it('reattaches a child from another source to a cloud it respawns', async () => {
		const store = createFakeWorldStateStore()
		store.hold([storedPointCloud('cloud-a', 3)])
		const { world, rebuild } = await startSync(store, ['cloud-a'])
		const tool = world.spawn(traits.Name('tool'))
		hierarchy.setParent(tool, 'cloud-a')
		await expect.poll(() => tool.targetFor(ChildOf)).toBe(drawnEntity(world, 'cloud-a'))
		const before = drawnEntity(world, 'cloud-a')
		store.hold([storedPointCloud('cloud-a', 5)])

		rebuild()
		await expect.poll(() => drawnEntity(world, 'cloud-a')).not.toBe(before)

		await expect.poll(() => tool.targetFor(ChildOf)).toBe(drawnEntity(world, 'cloud-a'))
	})

	it('reattaches a child to a cloud whose rebuild fetch failed once', async () => {
		const store = createFakeWorldStateStore()
		store.hold([storedPointCloud('cloud-a', 3)])
		const { world, rebuild } = await startSync(store, ['cloud-a'])
		const tool = world.spawn(traits.Name('tool'))
		hierarchy.setParent(tool, 'cloud-a')
		await expect.poll(() => tool.targetFor(ChildOf)).toBe(drawnEntity(world, 'cloud-a'))
		const before = drawnEntity(world, 'cloud-a')
		store.failNextFetch('cloud-a')

		rebuild()
		await expect.poll(() => drawnEntity(world, 'cloud-a')).not.toBe(before)

		await expect.poll(() => tool.targetFor(ChildOf)).toBe(drawnEntity(world, 'cloud-a'))
	})

	it('drops colors the new instance no longer holds', async () => {
		const store = createFakeWorldStateStore()
		store.hold([storedTransform('frame-a', { geometryType: BOX, color: [255, 0, 0] })])
		const { world, rebuild } = await startSync(store, ['frame-a'])
		await expect.poll(() => drawnEntity(world, 'frame-a')?.has(traits.Color)).toBe(true)
		store.hold([storedTransform('frame-a', { geometryType: BOX })])

		rebuild()

		await expect.poll(() => drawnEntity(world, 'frame-a')?.has(traits.Color)).toBe(false)
	})

	it('removes a frame whose fetch keeps failing, rather than show the old one', async () => {
		const store = createFakeWorldStateStore()
		store.hold([storedTransform('frame-a'), storedTransform('frame-b')])
		const { world, rebuild } = await startSync(store, ['frame-a', 'frame-b'])
		store.failNextFetch('frame-b', 100)

		rebuild()

		await expect.poll(() => drawnNames(world)).toEqual(['frame-a'])
	})

	it('renames an entity the new instance holds under a new name', async () => {
		const store = createFakeWorldStateStore()
		store.hold([storedTransform('uuid-1', { name: 'frame-a' })])
		const { world, rebuild } = await startSync(store, ['frame-a'])
		store.hold([storedTransform('uuid-1', { name: 'frame-z' })])

		rebuild()

		await expect.poll(() => drawnNames(world)).toEqual(['frame-z'])
	})

	it('removes geometry the new instance no longer holds', async () => {
		const store = createFakeWorldStateStore()
		store.hold([storedTransform('frame-a', { geometryType: BOX })])
		const { world, rebuild } = await startSync(store, ['frame-a'])
		store.hold([storedTransform('frame-a', { xMillimeters: 100 })])

		rebuild()
		await expect.poll(() => drawnX(world, 'frame-a')).toBeCloseTo(0.1)

		expect(drawnEntity(world, 'frame-a')?.has(traits.Box)).toBe(false)
	})

	it('keeps a pose the stream reported while the snapshot loaded', async () => {
		const store = createFakeWorldStateStore()
		store.hold([storedTransform('frame-a')])
		const { world, rebuild } = await startSync(store, ['frame-a'])
		store.hold([storedTransform('frame-a')], [poseUpdate('frame-a', 100)])
		const release = store.gateTransforms()
		rebuild()
		await store.eventsDelivered()
		await settle()

		release()
		await settle()
		await settle()

		expect(drawnX(world, 'frame-a')).toBeCloseTo(0.1)
	})

	it('replays an addition and a removal that arrived while the snapshot loaded', async () => {
		const store = createFakeWorldStateStore()
		store.hold([storedTransform('frame-a'), storedTransform('frame-b')])
		const { world, rebuild } = await startSync(store, ['frame-a', 'frame-b'])
		store.hold(
			[storedTransform('frame-a'), storedTransform('frame-b')],
			[addition(storedTransform('frame-c')), removal('frame-b')]
		)
		const release = store.gateTransforms()
		rebuild()
		await store.eventsDelivered()
		await settle()

		release()

		await expect.poll(() => drawnNames(world)).toEqual(['frame-a', 'frame-c'])
	})

	it('keeps a removal that was waiting to flush when a snapshot retry began', async () => {
		const store = createFakeWorldStateStore()
		store.hold([storedTransform('frame-a'), storedTransform('frame-b')])
		const { world, rebuild, pauseFrames, resumeFrames } = await startSync(store, [
			'frame-a',
			'frame-b',
		])
		pauseFrames()
		store.failNextSnapshot()
		const release = store.gateTransforms()
		rebuild()
		store.emit(removal('frame-b'))
		await expect.poll(() => store.snapshotsTaken()).toBe(3)

		resumeFrames()
		release()
		await settle()
		await settle()

		expect(drawnNames(world)).toEqual(['frame-a'])
	})
})

describe('createWorldStateSync, when its stream ends on its own', () => {
	it('reopens it and draws what changed meanwhile', async () => {
		const store = createFakeWorldStateStore()
		store.hold([storedTransform('frame-a')])
		const { world } = await startSync(store, ['frame-a'])
		store.hold([storedTransform('frame-a'), storedTransform('frame-b')])

		await store.closeStream()

		await expect.poll(() => drawnNames(world)).toEqual(['frame-a', 'frame-b'])
	})

	it('stops reopening it when the store does not implement streaming', async () => {
		const store = createFakeWorldStateStore()
		store.hold([storedTransform('frame-a')])
		await startSync(store, ['frame-a'])

		await store.failStream(new ConnectError('not implemented', Code.Unimplemented))
		await new Promise((resolve) => setTimeout(resolve, TIMING.retryMaxDelayMs * 2))

		expect(store.snapshotsTaken()).toBe(1)
	})

	it('stays a rebuild when the connection drops before it reopens', async () => {
		const store = createFakeWorldStateStore()
		store.hold([storedPointCloud('cloud-a', 3)])
		const { world, disconnect, reconnect } = await startSync(store, ['cloud-a'], '')
		await expect.poll(() => drawnPointCount(world, 'cloud-a')).toBe(3)
		store.hold([storedPointCloud('cloud-a', 5)])
		await store.closeStream()
		disconnect()

		reconnect()

		await expect.poll(() => drawnPointCount(world, 'cloud-a')).toBe(5)
	})

	it('logs a transform that keeps failing once, across reopens', async () => {
		const store = createFakeWorldStateStore()
		store.failNextFetch('frame-b', 100)
		store.hold([storedTransform('frame-a'), storedTransform('frame-b')])
		const { logged } = await startSync(store, ['frame-a'])

		await store.closeStream()
		await expect.poll(() => store.snapshotsTaken()).toBe(2)
		await settle()

		expect(logged.filter((message) => message.includes('transforms failed'))).toHaveLength(1)
	})

	it('reopens it after an error too', async () => {
		const store = createFakeWorldStateStore()
		store.hold([storedTransform('frame-a')])
		const { world } = await startSync(store, ['frame-a'])
		store.hold([storedTransform('frame-a'), storedTransform('frame-b')])

		await store.failStream()

		await expect.poll(() => drawnNames(world)).toEqual(['frame-a', 'frame-b'])
	})

	it('reloads a cloud when no generation can say whether the instance changed', async () => {
		const store = createFakeWorldStateStore()
		store.hold([storedPointCloud('cloud-a', 3)])
		const { world } = await startSync(store, ['cloud-a'], '')
		await expect.poll(() => drawnPointCount(world, 'cloud-a')).toBe(3)
		store.hold([storedPointCloud('cloud-a', 5)])

		await store.closeStream()

		await expect.poll(() => drawnPointCount(world, 'cloud-a')).toBe(5)
	})

	it('keeps a drawn cloud when a known generation says the instance is the same', async () => {
		const store = createFakeWorldStateStore()
		store.hold([storedPointCloud('cloud-a', 3)])
		const { world } = await startSync(store, ['cloud-a'])
		await expect.poll(() => drawnPointCount(world, 'cloud-a')).toBe(3)
		const before = drawnEntity(world, 'cloud-a')

		await store.closeStream()
		await expect.poll(() => store.snapshotsTaken()).toBe(2)
		await settle()

		expect(drawnEntity(world, 'cloud-a')).toBe(before)
	})
})

describe('createWorldStateSync, when the store is not rebuilt', () => {
	it('moves a cloud that moved while the connection was down', async () => {
		const store = createFakeWorldStateStore()
		store.hold([storedPointCloud('cloud-a', 3)])
		const { world, reconnect } = await startSync(store, ['cloud-a'])
		await expect.poll(() => drawnPointCount(world, 'cloud-a')).toBe(3)
		store.hold([
			storedTransform('cloud-a', {
				xMillimeters: 100,
				geometryType: storedPointCloud('cloud-a', 1).physicalObject?.geometryType,
			}),
		])

		reconnect()

		await expect.poll(() => drawnX(world, 'cloud-a')).toBeCloseTo(0.1)
	})

	it('keeps every point of a chunked cloud on a reconnect, though a read carries only the first chunk', async () => {
		const store = createFakeWorldStateStore()
		store.hold([storedChunkedCloud('cloud-a', 2, 4)])
		const { world, reconnect } = await startSync(store, ['cloud-a'])
		await expect.poll(() => drawnPointCount(world, 'cloud-a')).toBe(4)
		store.hold([storedChunkedCloud('cloud-a', 2, 4), storedPointCloud('cloud-b', 1)])

		reconnect()
		await expect
			.poll(() => drawnPointCount(world, 'cloud-b'), {
				message: 'cloud-b parses after any re-parse of cloud-a, since one worker answers in order',
			})
			.toBe(1)

		expect(drawnPointCount(world, 'cloud-a')).toBe(4)
	})

	it('shows the changed points of an unchunked cloud after a reconnect', async () => {
		const store = createFakeWorldStateStore()
		store.hold([storedPointCloud('cloud-a', 3)])
		const { world, reconnect } = await startSync(store, ['cloud-a'])
		await expect.poll(() => drawnPointCount(world, 'cloud-a')).toBe(3)
		store.hold([storedPointCloud('cloud-a', 5)])

		reconnect()

		await expect.poll(() => drawnPointCount(world, 'cloud-a')).toBe(5)
	})

	it('fetches a chunked cloud whole when the stream updates its points', async () => {
		const store = createFakeWorldStateStore()
		store.hold([storedChunkedCloud('cloud-a', 2, 4)])
		const { world } = await startSync(store, ['cloud-a'])
		await expect.poll(() => drawnPointCount(world, 'cloud-a')).toBe(4)
		store.hold([storedChunkedCloud('cloud-a', 2, 6)])

		store.emit(pointsUpdate(storedChunkedCloud('cloud-a', 2, 6)))

		await expect.poll(() => drawnPointCount(world, 'cloud-a')).toBe(6)
	})

	it('applies an update that arrives while it fetches a transform the stream named', async () => {
		const store = createFakeWorldStateStore()
		store.hideFromList('frame-b')
		const release = store.gateTransform('frame-b')
		store.hold(
			[storedTransform('frame-a'), storedTransform('frame-b')],
			[poseUpdate('frame-b', 100)]
		)
		const { world } = await startSync(store, ['frame-a'])
		await expect.poll(() => store.fetchedUUIDs()).toContain('frame-b')
		store.emit(poseUpdate('frame-b', 200))
		// One turn for the stream to hand the event over, one for the flush that would apply it.
		await settle()
		await settle()
		await settle()

		release()

		await expect.poll(() => drawnX(world, 'frame-b')).toBeCloseTo(0.2)
	})

	it('retries a transform that failed to load without reopening the stream', async () => {
		const store = createFakeWorldStateStore()
		store.failNextFetch('frame-b')
		store.hold([storedTransform('frame-a'), storedTransform('frame-b')])

		await startSync(store, ['frame-a', 'frame-b'])

		expect(store.snapshotsTaken()).toBe(1)
	})

	it('keeps other transforms live while it retries one', async () => {
		const store = createFakeWorldStateStore()
		store.failNextFetch('frame-b')
		store.gateTransform('frame-b')
		store.hold([storedTransform('frame-a'), storedTransform('frame-b')])
		const { world } = await startSync(store, ['frame-a'])
		await expect.poll(() => store.fetchedUUIDs()).toEqual(['frame-a', 'frame-b', 'frame-b'])

		store.emit(poseUpdate('frame-a', 100))

		await expect.poll(() => drawnX(world, 'frame-a')).toBeCloseTo(0.1)
	})

	it('logs a transform that keeps failing once, not on every retry', async () => {
		const store = createFakeWorldStateStore()
		store.failNextFetch('frame-b', 3)
		store.hold([storedTransform('frame-a'), storedTransform('frame-b')])
		const { world, logged } = await startSync(store, ['frame-a'])

		await expect.poll(() => drawnNames(world)).toEqual(['frame-a', 'frame-b'])

		expect(logged.filter((message) => message.includes('transforms failed'))).toHaveLength(1)
	})

	it('stops retrying a transform the stream removed', async () => {
		const store = createFakeWorldStateStore()
		store.failNextFetch('frame-b', 100)
		store.hold([storedTransform('frame-a'), storedTransform('frame-b')])
		const { world } = await startSync(store, ['frame-a'])
		store.emit(removal('frame-b'))
		await settle()
		store.forgetFetches()

		await new Promise((resolve) => setTimeout(resolve, TIMING.retryMaxDelayMs * 2))

		expect(store.fetchedUUIDs()).toEqual([])
		expect(drawnNames(world)).toEqual(['frame-a'])
	})

	it('retries a failed snapshot without reopening the stream', async () => {
		const store = createFakeWorldStateStore()
		store.failNextSnapshot()
		store.hold([storedTransform('frame-a')])

		await startSync(store, ['frame-a'])

		expect(store.snapshotsTaken()).toBe(2)
		expect(store.streamsOpened()).toBe(1)
	})

	it('retries a failed reconnect snapshot without reloading drawn clouds', async () => {
		const store = createFakeWorldStateStore()
		store.hold([storedPointCloud('cloud-a', 3)])
		const { world, reconnect } = await startSync(store, ['cloud-a'])
		await expect.poll(() => drawnPointCount(world, 'cloud-a')).toBe(3)
		const before = drawnEntity(world, 'cloud-a')
		store.hold([storedPointCloud('cloud-a', 5), storedTransform('frame-b')])
		store.failNextSnapshot()

		reconnect()
		await expect.poll(() => drawnNames(world)).toEqual(['cloud-a', 'frame-b'])

		expect(drawnEntity(world, 'cloud-a')).toBe(before)
	})

	it('moves a frame that moved while the connection was down', async () => {
		const store = createFakeWorldStateStore()
		store.hold([storedTransform('frame-a')])
		const { world, reconnect } = await startSync(store, ['frame-a'])
		store.hold([storedTransform('frame-a', { xMillimeters: 100 })])

		reconnect()

		await expect.poll(() => drawnX(world, 'frame-a')).toBeCloseTo(0.1)
	})

	it('marks nothing changed when the reconnect snapshot matches the scene', async () => {
		const store = createFakeWorldStateStore()
		store.hold([storedTransform('frame-a', { xMillimeters: 100 })])
		const { world, reconnect } = await startSync(store, ['frame-a'])
		const matrixChanges = vi.fn()
		const unsubscribe = world.onChange(traits.Matrix, matrixChanges)

		reconnect()
		await expect.poll(() => store.snapshotsTaken()).toBe(2)
		await settle()
		unsubscribe()

		expect(matrixChanges).not.toHaveBeenCalled()
	})

	it('lists the store once when the first machine status arrives after it starts', async () => {
		const store = createFakeWorldStateStore()
		store.hold([storedTransform('frame-a')])
		const { reportGeneration } = await startSync(store, ['frame-a'], '')

		reportGeneration('1')

		expect(store.snapshotsTaken()).toBe(1)
	})

	it('lists the store once when its status drops out and returns', async () => {
		const store = createFakeWorldStateStore()
		store.hold([storedTransform('frame-a')])
		const { reportGeneration } = await startSync(store, ['frame-a'])
		reportGeneration('')

		reportGeneration('1')

		expect(store.snapshotsTaken()).toBe(1)
	})

	it('draws nothing from a fetch that lands after it is disposed', async () => {
		const store = createFakeWorldStateStore()
		store.hideFromList('frame-b')
		const release = store.gateTransform('frame-b')
		store.hold(
			[storedTransform('frame-a'), storedTransform('frame-b')],
			[poseUpdate('frame-b', 100)]
		)
		const { world, dispose } = await startSync(store, ['frame-a'])
		await expect.poll(() => store.fetchedUUIDs()).toContain('frame-b')
		dispose()

		release()
		await settle()

		expect(drawnNames(world)).toEqual([])
	})
})
