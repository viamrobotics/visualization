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
 */
export const createFakeWorldStateStore = () => {
	let generation = $state('1')
	let transforms: TransformWithUUID[] = []
	let events: TransformChangeEvent[] = []

	const client = {
		listUUIDs: async () => transforms.map((transform) => transform.uuidString),
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
	}
}
