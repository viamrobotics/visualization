import { toPath, getInUnsafe, mutInUnsafe } from '@thi.ng/paths'
import {
	WorldStateStoreClient,
	type TransformChangeEvent,
	TransformChangeType,
} from '@viamrobotics/sdk'
import {
	createResourceClient,
	createResourceQuery,
	createResourceStream,
	useResourceNames,
} from '@viamrobotics/svelte-sdk'
import { fromTransform, WorldObject } from '$lib/WorldObject.svelte'
import { usePartID } from './usePartID.svelte'

export const useWorldStates = () => {
	const partID = usePartID()
	const resourceNames = useResourceNames(() => partID.current, 'world_state_store')
	const current = $derived.by(() =>
		resourceNames.current.map(({ name }) =>
			useWorldState(
				() => partID.current,
				() => name
			)
		)
	)

	return {
		get names() {
			return resourceNames.current
		},
		get current() {
			return current
		},
	}
}

export const useWorldState = (partID: () => string, resourceName: () => string) => {
	const client = createResourceClient(WorldStateStoreClient, partID, resourceName)
	let initialized = false

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

	const worldObjects = $state<Record<string, WorldObject>>({})
	const initializeCurrent = (objects: WorldObject[]) => {
		for (const object of objects) {
			worldObjects[object.uuid] = object
		}

		initialized = true
	}

	$effect(() => {
		if (!getTransforms) {
			return
		}

		if (initialized) {
			return
		}

		const queries = getTransforms.map((query) => query.current)
		if (queries.some((query) => query?.isLoading)) {
			return
		}

		const objects: WorldObject[] = []
		for (const transform of queries.flatMap((query) => query.data) ?? []) {
			if (transform === undefined) {
				continue
			}
			objects.push(fromTransform(transform))
		}

		initializeCurrent(objects)
	})

	const processChangeEvent = async (event: TransformChangeEvent) => {
		if (event.transform === undefined) {
			return
		}
		switch (event.changeType) {
			case TransformChangeType.ADDED:
				worldObjects[event.transform.uuidString] = fromTransform(event.transform)
				break
			case TransformChangeType.UPDATED:
				for (const path of event.updatedFields?.paths ?? []) {
					// Type inference is tough here, so we use unsafe APIs
					const paths = toPath(path)
					const next = getInUnsafe(event.transform, paths)
					mutInUnsafe(worldObjects[event.transform.uuidString], paths, next)
				}
				break
			case TransformChangeType.REMOVED:
				delete worldObjects[event.transform.uuidString]
				break
		}
	}

	$effect(() => {
		for (const event of changeStream.current?.data ?? []) {
			void processChangeEvent(event)
		}
	})

	return {
		get name() {
			return resourceName()
		},
		get objects() {
			return Object.values(worldObjects)
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
	}
}
