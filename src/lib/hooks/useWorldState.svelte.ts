import {
	WorldStateStoreClient,
	TransformChangeType,
	type TransformWithUUID,
	ResourceName,
} from '@viamrobotics/sdk'
import {
	createResourceClient,
	createResourceQuery,
	createResourceStream,
	useResourceNames,
} from '@viamrobotics/svelte-sdk'
import { fromTransform } from '$lib/WorldObject.svelte'
import { usePartID } from './usePartID.svelte'
import { mutInUnsafe } from '@thi.ng/paths'
import type { ProcessMessage } from '$lib/world-state-messages'
import { getContext, setContext } from 'svelte'

const key = Symbol('world-state-context')

interface Context {
	names: ResourceName[]
	current: Record<string, ReturnType<typeof createWorldState>>
}

export const provideWorldStates = () => {
	const partID = usePartID()
	const resourceNames = useResourceNames(() => partID.current, 'world_state_store')
	const current = $derived.by(() =>
		Object.fromEntries(
			resourceNames.current.map(({ name }) => [
				name,
				createWorldState(
					() => partID.current,
					() => name
				),
			])
		)
	)

	setContext<Context>(key, {
		get names() {
			return resourceNames.current
		},
		get current() {
			return current
		},
	})
}

export const useWorldStates = () => {
	return getContext<Context>(key)
}

export const useWorldState = (resourceName: () => string) => {
	return useWorldStates().current[resourceName()]
}

const createWorldState = (partID: () => string, resourceName: () => string) => {
	const client = createResourceClient(WorldStateStoreClient, partID, resourceName)
	let worker: Worker

	let initialized = $state(false)
	let transforms = $state.raw<Record<string, TransformWithUUID>>({})

	const transformsList = $derived.by(() => Object.values(transforms))
	const worldObjectsList = $derived.by(() => transformsList.map(fromTransform))

	let pendingEvents: ProcessMessage['events'] = []
	let flushScheduled = false

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

	const changeStream = createResourceStream(client, 'streamTransformChanges', {
		refetchMode: 'replace',
	})

	const initialize = (initial: TransformWithUUID[]) => {
		const next = { ...transforms }
		for (const transform of initial) {
			next[transform.uuidString] = transform
		}

		transforms = next
		initialized = true
	}

	const applyEvents = (events: ProcessMessage['events']) => {
		for (const event of events) {
			const next = { ...transforms }
			switch (event.type) {
				case TransformChangeType.ADDED:
					next[event.uuidString] = event.transform
					break
				case TransformChangeType.REMOVED:
					delete next[event.uuidString]
					break
				case TransformChangeType.UPDATED:
					for (const [path, value] of event.changes) {
						mutInUnsafe(next[event.uuidString], path, value)
					}
					break
			}

			transforms = next
		}
	}

	const scheduleFlush = () => {
		if (flushScheduled) {
			return
		}
		flushScheduled = true
		requestAnimationFrame(() => {
			flushScheduled = false
			const toApply = pendingEvents
			pendingEvents = []
			applyEvents(toApply)
		})
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

		const objects: TransformWithUUID[] = []
		for (const transform of queries.flatMap((query) => query.data) ?? []) {
			if (transform === undefined) {
				continue
			}
			objects.push(transform)
		}

		initialize(objects)
	})

	$effect(() => {
		if (!worker) {
			worker = new Worker(new URL('../workers/worldStateWorker.ts', import.meta.url), {
				type: 'module',
			})
		}

		worker.onmessage = (e: MessageEvent<ProcessMessage>) => {
			if (e.data.type !== 'process') {
				return
			}

			const { events } = e.data ?? { events: [] }

			pendingEvents.push(...events)
			scheduleFlush()
		}

		return () => {
			console.log('terminate worker', worker)
			worker.terminate()
		}
	})

	$effect.pre(() => {
		if (changeStream.current?.data === undefined) {
			return
		}

		if (changeStream.current.data.length === 0) {
			return
		}

		worker.postMessage({ type: 'change', events: changeStream.current.data })
	})

	return {
		get name() {
			return resourceName()
		},
		get transforms() {
			return transformsList
		},
		get worldObjects() {
			return worldObjectsList
		},
		get listUUIDs() {
			return listUUIDs.current
		},
		get getTransforms() {
			return getTransforms?.map((query) => query.current)
		},
	}
}
