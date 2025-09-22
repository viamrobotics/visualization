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
	streamQueryKey,
	useResourceNames,
} from '@viamrobotics/svelte-sdk'
import { useQueryClient } from '@tanstack/svelte-query'
import {
	fromPointcloudTransform,
	fromTransform,
	parseMetadata,
	type PointsGeometry,
	WorldObject,
} from '$lib/WorldObject.svelte'
import { usePartID } from './usePartID.svelte'
import { setInUnsafe } from '@thi.ng/paths'
import { postChangeMessage, type ProcessMessage } from '$lib/world-state-messages'
import { getContext, setContext } from 'svelte'
import WorldStateWorker from '../workers/worldStateWorker?worker'
import { parsePcdInWorker } from '$lib/loaders/pcd'
import type { PointcloudTransform } from '$lib/WorldObject.svelte'

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
	const worker = new WorldStateWorker({ name: `${resourceName()}-worker` })
	const queryClient = useQueryClient()
	const client = createResourceClient(WorldStateStoreClient, partID, resourceName)

	let initialized = $state(false)
	let transforms = $state.raw<Record<string, TransformWithUUID>>({})
	let pointclouds = $state<Record<string, PointcloudTransform>>({})

	const transformsList = $derived.by(() => Object.values(transforms))
	const worldObjectsList = $derived.by(() => transformsList.map(fromTransform))
	const pointcloudsList = $derived.by(() => Object.values(pointclouds).map(fromPointcloudTransform))

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

	const loadPointcloud = async (transform: TransformWithUUID) => {
		if (transform.physicalObject?.geometryType.case !== 'pointcloud') return
		const pointcloud = transform.physicalObject.geometryType.value.pointCloud
		const { positions, colors } = await parsePcdInWorker(pointcloud)
		pointclouds[transform.uuidString] = {
			...transform,
			positions,
			colors,
		}
	}

	const initialize = (initial: TransformWithUUID[]) => {
		const next = { ...transforms }
		for (const transform of initial) {
			if (transform.physicalObject?.geometryType.case === 'pointcloud') {
				void loadPointcloud(transform)
			} else {
				next[transform.uuidString] = transform
			}
		}

		transforms = next
		initialized = true
	}

	const applyEvents = (events: ProcessMessage['events']) => {
		if (events.length === 0) return

		const next = { ...transforms }
		for (const event of events) {
			switch (event.type) {
				case TransformChangeType.ADDED:
					if (event.transform.physicalObject?.geometryType.case === 'pointcloud') {
						void loadPointcloud(event.transform)
					} else {
						next[event.uuidString] = event.transform
					}
					break
				case TransformChangeType.REMOVED:
					delete next[event.uuidString]
					break
				case TransformChangeType.UPDATED: {
					if (event.changes.length === 0) continue
					if (event.transform.physicalObject?.geometryType.case === 'pointcloud') {
						// TODO: Update the pointcloud in place?
						void loadPointcloud(event.transform)
					} else {
						let toUpdate = next[event.uuidString]
						if (!toUpdate) continue
						for (const [path, value] of event.changes) {
							toUpdate = setInUnsafe(toUpdate, path, value)
						}

						next[event.uuidString] = toUpdate
					}

					break
				}
			}
		}

		transforms = next
	}

	const scheduleFlush = () => {
		if (flushScheduled) return
		flushScheduled = true

		requestAnimationFrame(() => {
			const toApply = pendingEvents
			if (toApply.length === 0) return

			applyEvents(toApply)
			flushScheduled = false
			pendingEvents = []
		})
	}

	$effect(() => {
		if (!getTransforms) return
		if (initialized) return

		const queries = getTransforms.map((query) => query.current)
		if (queries.some((query) => query?.isLoading)) return

		const data = queries
			.flatMap((query) => query?.data ?? [])
			.filter((transform) => transform !== undefined) as TransformWithUUID[]
		if (data.length === 0) return

		initialize(data)
	})

	$effect(() => {
		worker.onmessage = (e: MessageEvent<ProcessMessage>) => {
			if (e.data.type !== 'process') return

			const { events } = e.data ?? { events: [] }
			if (events.length === 0) return

			pendingEvents.push(...events)
			scheduleFlush()
		}

		return () => {
			worker.terminate()
		}
	})

	$effect.pre(() => {
		if (changeStream.current?.data === undefined) return

		const events = changeStream.current.data.filter((event) => event.transform !== undefined)
		if (events.length === 0) return

		postChangeMessage(worker, { type: 'change', events })

		// clear the stream data to prevent event accumulation and memory issues
		queryClient.setQueryData(streamQueryKey(partID(), resourceName(), 'streamTransformChanges'), [])
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
		get pointclouds() {
			return pointcloudsList
		},
		get listUUIDs() {
			return listUUIDs.current
		},
		get getTransforms() {
			return getTransforms?.map((query) => query.current)
		},
	}
}
