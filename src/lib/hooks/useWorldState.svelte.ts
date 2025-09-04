import { getContext, setContext } from 'svelte'
import {
	WorldStateStoreClient,
	type TransformChangeEvent,
	TransformChangeType,
	type TransformWithUUID,
} from '@viamrobotics/sdk'
import {
	createResourceClient,
	createResourceQuery,
	createResourceStream,
} from '@viamrobotics/svelte-sdk'

const key = Symbol('world-state-context')

export const provideWorldState = (partID: () => string, resourceName: () => string) => {
	const client = createResourceClient(WorldStateStoreClient, partID, resourceName)

	const listUUIDs = createResourceQuery(client, 'listUUIDs')
	const getTransforms = $derived(
		listUUIDs.current.data?.map((uuid) => {
			return createResourceQuery(
				client,
				'getTransform',
				() => [uuid] as const,
				() => ({ refetchInterval: false })
			)
		})
	)

	const changeStream = createResourceStream(client, 'streamTransformChanges')

	const current = $state<Record<string, TransformWithUUID>>({})
	$effect(() => {
		for (const transform of getTransforms?.flatMap((query) => query.current.data) ?? []) {
			if (transform === undefined) {
				continue
			}
			current[transform.uuidString] = transform
		}
	})

	const processChangeEvent = async (event: TransformChangeEvent) => {
		if (event.transform === undefined) {
			return
		}
		switch (event.changeType) {
			case TransformChangeType.ADDED:
				current[event.transform.uuidString] = event.transform
				break
			case TransformChangeType.UPDATED:
				// TODO: apply changes not overwriting existing values
				current[event.transform.uuidString] = event.transform
				break
			case TransformChangeType.REMOVED:
				delete current[event.transform.uuidString]
				break
		}
	}

	$effect(() => {
		for (const event of changeStream.current?.data ?? []) {
			void processChangeEvent(event)
		}
	})

	return setContext(key, {
		get current() {
			return current
		},
		get listUUIDs() {
			return listUUIDs.current
		},
		get getTransforms() {
			return getTransforms?.map((query) => query.current)
		},
		get changeStream() {
			return changeStream.current
		},
	})
}

export const useWorldState = () => {
	return getContext<ReturnType<typeof provideWorldState>>(key)
}
