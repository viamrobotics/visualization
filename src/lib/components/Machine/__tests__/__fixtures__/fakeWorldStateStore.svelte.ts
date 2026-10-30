import {
	Struct,
	type TransformChangeEvent,
	TransformChangeType,
	type TransformWithUUID,
} from '@viamrobotics/sdk'
import { createResourceClient, useResourceGeneration } from '@viamrobotics/svelte-sdk'
import { flushSync } from 'svelte'
import { vi } from 'vitest'

interface StoredTransformOptions {
	/** Defaults to the uuid. */
	name?: string
	xMillimeters?: number
	/** A `physicalObject.geometryType`. Omit for a pose-only frame. */
	geometryType?: unknown
}

/** A transform under `uuid`, `xMillimeters` along x from the world origin. */
export const storedTransform = (
	uuid: string,
	{ name = uuid, xMillimeters = 0, geometryType }: StoredTransformOptions = {}
) =>
	({
		uuidString: uuid,
		referenceFrame: name,
		poseInObserverFrame: {
			referenceFrame: 'world',
			pose: { x: xMillimeters, y: 0, z: 0, oX: 0, oY: 0, oZ: 1, theta: 0 },
		},
		...(geometryType !== undefined && { physicalObject: { geometryType } }),
	}) as unknown as TransformWithUUID

export const BOX = { case: 'box', value: { dimsMm: { x: 10, y: 10, z: 10 } } }
export const SPHERE = { case: 'sphere', value: { radiusMm: 10 } }

const asciiPcd = (points: number) => {
	const rows = Array.from({ length: points }, (_, index) => `${index} 0 0`)
	const header = [
		'VERSION .7',
		'FIELDS x y z',
		'SIZE 4 4 4',
		'TYPE F F F',
		'COUNT 1 1 1',
		`WIDTH ${points}`,
		'HEIGHT 1',
		'VIEWPOINT 0 0 0 1 0 0 0',
		`POINTS ${points}`,
		'DATA ascii',
	]
	return new TextEncoder().encode([...header, ...rows, ''].join('\n'))
}

/** A point cloud under `uuid` whose inline PCD holds `points` points. */
export const storedPointCloud = (uuid: string, points: number) =>
	storedTransform(uuid, {
		geometryType: { case: 'pointcloud', value: { pointCloud: asciiPcd(points) } },
	})

/**
 * A chunked point cloud under `uuid`. Its inline PCD is the first chunk of
 * `firstChunkPoints` points, and the store serves the rest of `total` on request.
 */
export const storedChunkedCloud = (uuid: string, firstChunkPoints: number, total: number) => ({
	...storedPointCloud(uuid, firstChunkPoints),
	metadata: Struct.fromJson({
		chunks: { chunk_size: firstChunkPoints, total, stride: 3 },
	}),
})

const base64Positions = (points: number) => {
	const bytes = new Uint8Array(new Float32Array(points * 3).buffer)
	return btoa(String.fromCharCode(...bytes))
}

/** A change event that removes the transform `uuid`. */
export const removal = (uuid: string) =>
	({
		changeType: TransformChangeType.REMOVED,
		transform: storedTransform(uuid),
	}) as unknown as TransformChangeEvent

/** A change event that moves `uuid` to `xMillimeters` and reports only the pose as changed. */
export const poseUpdate = (uuid: string, xMillimeters: number) =>
	({
		changeType: TransformChangeType.UPDATED,
		transform: storedTransform(uuid, { xMillimeters }),
		updatedFields: { paths: ['pose_in_observer_frame'] },
	}) as unknown as TransformChangeEvent

/**
 * Stands in for one `world_state_store` behind the mocked svelte-sdk. Each stream
 * it opens replays `events` and stays open until aborted or closed, as a live
 * stream does. Expects the spec to `vi.mock('@viamrobotics/svelte-sdk')`.
 *
 * @param initialGeneration What the machine status reports for the store at
 *   mount. Empty means no status has arrived yet.
 */
export const createFakeWorldStateStore = (initialGeneration = '1') => {
	let generation = $state(initialGeneration)
	let transforms: TransformWithUUID[] = []
	let events: TransformChangeEvent[] = []
	let snapshotsTaken = 0
	let fetched: string[] = []
	let transformGate: Promise<void> | undefined
	let drained = Promise.withResolvers<void>()
	const closeStreams = new Set<() => void>()

	const createClient = () => ({
		listUUIDs: async () => {
			snapshotsTaken++
			return transforms.map((transform) => transform.uuidString)
		},
		getTransform: async (uuid: string) => {
			fetched.push(uuid)
			await transformGate
			const transform = transforms.find((stored) => stored.uuidString === uuid)
			if (!transform) throw new Error(`No transform ${uuid}`)
			return transform
		},
		// Serves `get_entity_chunk` as one final chunk holding every point past `start`.
		doCommand: async (command: Struct) => {
			const { uuid, start } = command.toJson() as { uuid: string; start: number }
			const transform = transforms.find((stored) => stored.uuidString === uuid)
			const chunks = (transform?.metadata as Struct | undefined)?.toJson() as
				| { chunks?: { total: number } }
				| undefined
			const total = chunks?.chunks?.total ?? start

			return {
				entity: { physical_object: { points: { positions: base64Positions(total - start) } } },
				start,
				done: true,
			}
		},
		streamTransformChanges: async function* (_extra: unknown, { signal }: { signal: AbortSignal }) {
			yield* events
			// The consumer asks for the next event only after taking the last one.
			drained.resolve()
			await new Promise<void>((resolve) => {
				signal.addEventListener('abort', () => resolve())
				closeStreams.add(resolve)
			})
		},
	})

	let client = $state.raw(createClient())

	vi.mocked(createResourceClient).mockReturnValue({
		get current() {
			return client
		},
	} as unknown as ReturnType<typeof createResourceClient>)
	vi.mocked(useResourceGeneration).mockReturnValue({
		get current() {
			return generation
		},
		canQuery: true,
	})

	const closeOpenStreams = () => {
		for (const close of closeStreams) close()
		closeStreams.clear()
	}

	return {
		/** Sets what the store holds, and what the next stream it opens reports. */
		hold: (next: TransformWithUUID[], nextEvents: TransformChangeEvent[] = []) => {
			transforms = next
			events = nextEvents
		},
		/** Replaces the store with a new instance under the same name, closing its stream. */
		rebuild: () => {
			closeOpenStreams()
			drained = Promise.withResolvers<void>()
			generation = String(Number(generation || '1') + 1)
			flushSync()
		},
		/** Closes the open stream the way a closed instance does, and lets the scene see it end. */
		closeStream: async () => {
			closeOpenStreams()
			await new Promise((resolve) => setTimeout(resolve))
		},
		/** Sets what the machine status reports, as it would on its own poll. */
		reportGeneration: (value: string) => {
			generation = value
			flushSync()
		},
		/** Drops and restores the connection, reaching the same instance. */
		reconnect: () => {
			client = createClient()
			flushSync()
		},
		/** Holds every `getTransform` until the returned function is called. */
		gateTransforms: () => {
			let release = () => {}
			transformGate = new Promise((resolve) => {
				release = () => {
					transformGate = undefined
					resolve()
				}
			})
			return release
		},
		/** Resolves once the stream opened since the last rebuild has handed over every event. */
		eventsDelivered: () => drained.promise,
		/** Clears the record `fetchedUUIDs` reads. */
		forgetFetches: () => {
			fetched = []
		},
		/** Every uuid `getTransform` was asked for since the last `forgetFetches`. */
		fetchedUUIDs: () => [...fetched].toSorted(),
		/** How many times the scene has listed what the store holds. */
		snapshotsTaken: () => snapshotsTaken,
	}
}
