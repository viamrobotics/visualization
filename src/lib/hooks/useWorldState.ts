import { getContext, setContext } from 'svelte'
import {
	createResourceClient,
	createResourceStream,
	createResourceQuery,
} from '@viamrobotics/svelte-sdk'
import { fromTransform, WorldObject } from '$lib/WorldObject'
import { WorldStateStoreClient } from '@viamrobotics/sdk'

interface WorldStateStatus {
	listUUIDs: {
		fetching: boolean
		error?: Error
	}
	getTransforms: {
		fetchingCount: number
		errors: Error[]
	}
}

interface WorldStateContext {
	current: WorldObject[]
	status: WorldStateStatus
	changeStream: unknown
}

const key = Symbol('world-state-context')

export const provideWorldState = (partID: () => string, resourceName: () => string) => {
	const client = createResourceClient(WorldStateStoreClient, partID, resourceName)
	const listUUIDs = createResourceQuery(client, 'listUUIDs')
	const getTransforms = $derived(
		listUUIDs.current.data?.map((uuid) => createResourceQuery(client, 'getTransform', [uuid]))
	)
	const changeStream = createResourceStream(client, 'streamTransformChanges')

	const current = $derived.by(() => {
		const objects: WorldObject[] = []
		const transforms = getTransforms?.flatMap((query) => query.current.data) ?? []

		for (const transform of transforms) {
			if (transform === undefined) {
				continue
			}

			objects.push(fromTransform(transform))
		}

		return objects
	})

	const status = $state<WorldStateStatus>({
		listUUIDs: {
			fetching: false,
			error: undefined,
		},
		getTransforms: {
			fetchingCount: 0,
			errors: [],
		},
	})

	$effect(() => {
		status.listUUIDs.fetching = listUUIDs.current.isFetching
		status.listUUIDs.error = listUUIDs.current.error ?? undefined
	})

	$effect(() => {
		let fetchingCount = 0
		let errors: Error[] = []
		for (const query of getTransforms ?? []) {
			if (query.current.isFetching) {
				fetchingCount++
			}
			if (query.current.error) {
				errors.push(query.current.error)
			}
		}

		status.getTransforms.fetchingCount = fetchingCount
		status.getTransforms.errors = errors
	})

	setContext<WorldStateContext>(key, {
		get current() {
			return current
		},
		get status() {
			return status
		},
		get changeStream() {
			return changeStream
		},
	})
}

export const useWorldState = (): WorldStateContext => {
	return getContext<WorldStateContext>(key)
}
