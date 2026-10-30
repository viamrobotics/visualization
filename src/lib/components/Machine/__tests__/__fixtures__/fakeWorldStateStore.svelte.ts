import {
	type TransformChangeEvent,
	TransformChangeType,
	type TransformWithUUID,
} from '@viamrobotics/sdk'
import { createResourceClient, useResourceGeneration } from '@viamrobotics/svelte-sdk'
import { flushSync } from 'svelte'
import { vi } from 'vitest'

/** A transform named `uuid`, `xMillimeters` along x from the world origin. */
export const storedTransform = (uuid: string, xMillimeters = 0) =>
	({
		uuidString: uuid,
		referenceFrame: uuid,
		poseInObserverFrame: {
			referenceFrame: 'world',
			pose: { x: xMillimeters, y: 0, z: 0, oX: 0, oY: 0, oZ: 1, theta: 0 },
		},
	}) as unknown as TransformWithUUID

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

/** A point cloud named `uuid` whose inline PCD holds `points` points, `xMillimeters` along x. */
export const storedPointCloud = (uuid: string, points: number, xMillimeters = 0) =>
	({
		...storedTransform(uuid, xMillimeters),
		physicalObject: {
			geometryType: { case: 'pointcloud', value: { pointCloud: asciiPcd(points) } },
		},
	}) as unknown as TransformWithUUID

/** A change event that removes the transform `uuid`. */
export const removal = (uuid: string) =>
	({
		changeType: TransformChangeType.REMOVED,
		transform: storedTransform(uuid),
	}) as unknown as TransformChangeEvent

/**
 * Stands in for one `world_state_store` behind the mocked svelte-sdk. Each
 * stream it opens replays `events`, then ends, the way a stream does when its
 * resource closes. Expects the spec to `vi.mock('@viamrobotics/svelte-sdk')`.
 *
 * @param initialGeneration What the machine status reports for the store at
 *   mount. Empty means no status has arrived yet.
 */
export const createFakeWorldStateStore = (initialGeneration = '1') => {
	let generation = $state(initialGeneration)
	let transforms: TransformWithUUID[] = []
	let events: TransformChangeEvent[] = []
	let snapshotsTaken = 0

	const client = {
		listUUIDs: async () => {
			snapshotsTaken++
			return transforms.map((transform) => transform.uuidString)
		},
		getTransform: async (uuid: string) => {
			const transform = transforms.find((stored) => stored.uuidString === uuid)
			if (!transform) throw new Error(`No transform ${uuid}`)
			return transform
		},
		streamTransformChanges: async function* () {
			yield* events
		},
	}

	vi.mocked(createResourceClient).mockReturnValue({
		current: client,
	} as unknown as ReturnType<typeof createResourceClient>)
	vi.mocked(useResourceGeneration).mockReturnValue({
		get current() {
			return generation
		},
		canQuery: true,
	})

	return {
		/** Sets what the store holds, and what the next stream it opens reports. */
		hold: (next: TransformWithUUID[], nextEvents: TransformChangeEvent[] = []) => {
			transforms = next
			events = nextEvents
		},
		/** Replaces the store with a new instance under the same name. */
		rebuild: () => {
			generation = String(Number(generation) + 1)
			flushSync()
		},
		/** Delivers the first machine status, naming the instance already being read. */
		reportFirstStatus: () => {
			generation = '1'
			flushSync()
		},
		/** How many times the scene has listed what the store holds. */
		snapshotsTaken: () => snapshotsTaken,
	}
}
