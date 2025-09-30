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
import {
	fromTransform,
	parseMetadata,
	PointCloudWorldObject,
	WorldObject,
} from '$lib/WorldObject.svelte'
import { usePartID } from './usePartID.svelte'
import type { ProcessMessage } from '$lib/world-state-messages'
import { getContext, setContext, untrack } from 'svelte'
import { getPointCloud, getPointCloudHeader, isPointCloud } from '$lib/point-cloud'
import { omit } from 'lodash-es'
import { useQueryClient } from '@tanstack/svelte-query'

const key = Symbol('world-state-context')

interface Context {
	names: ResourceName[]
	current: Record<string, ReturnType<typeof createWorldState>>
}

const worker = new Worker(new URL('../workers/worldStateWorker', import.meta.url), {
	type: 'module',
})

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
	const queryClient = useQueryClient()
	const client = createResourceClient(WorldStateStoreClient, partID, resourceName)

	const transforms = $state<Record<string, WorldObject>>({})
	const pointClouds = $state<Record<string, PointCloudWorldObject>>({})
	let initialized = $state(false)

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

	const changeStream = createResourceStream(client, 'streamTransformChanges')

	const addPointCloud = (transform: TransformWithUUID) => {
		if (!isPointCloud(transform)) return

		const data = getPointCloud(transform)
		const header = getPointCloudHeader(transform)
		const pointCloud = new PointCloudWorldObject(
			transform.uuidString,
			transform.referenceFrame,
			transform.poseInObserverFrame,
			transform.physicalObject,
			parseMetadata(transform.metadata?.fields)
		)

		if (data && header) pointCloud.setFull(header, data)
		pointClouds[pointCloud.uuid] = pointCloud
	}

	const initialize = (initial: TransformWithUUID[]) => {
		for (const transform of initial) {
			if (isPointCloud(transform)) {
				addPointCloud(transform)
			} else {
				transforms[transform.uuidString] = fromTransform(transform)
			}
		}

		initialized = true
	}

	const applyEvents = (events: ProcessMessage['events']) => {
		if (events.length === 0) return
		for (const event of events) {
			switch (event.type) {
				case TransformChangeType.ADDED:
					if (isPointCloud(event.transform)) {
						addPointCloud(event.transform)
					} else {
						transforms[event.uuidString] = fromTransform(event.transform)
					}
					break
				case TransformChangeType.REMOVED:
					delete transforms[event.uuidString]
					delete pointClouds[event.uuidString]
					break
				case TransformChangeType.UPDATED: {
					if (event.changes.length === 0) continue

					// changes to the actual point cloud data is handled by the world object
					if (pointClouds[event.uuidString]) {
						pointClouds[event.uuidString].update(event.changes)
					} else if (transforms[event.uuidString]) {
						transforms[event.uuidString].update(event.changes)
					}
					break
				}
			}
		}
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

		initialize(data)
	})

	$effect(() => {
		const onMessage = (e: MessageEvent<ProcessMessage>) => {
			if (e.data.type !== 'process') return

			const { events } = e.data ?? { events: [] }
			if (events.length === 0) return

			pendingEvents.push(...events)
			scheduleFlush()
		}

		worker.addEventListener('message', onMessage as unknown as EventListener)
		return () => {
			worker.removeEventListener('message', onMessage as unknown as EventListener)
		}
	})

	$effect.pre(() => {
		if (changeStream.current?.data === undefined) return

		const events = changeStream.current.data.filter((event) => event.transform !== undefined)
		if (events.length === 0) return

		const transformEvents = []
		for (const event of events) {
			if (isPointCloud(event.transform)) {
				switch (event.changeType) {
					case TransformChangeType.ADDED:
					case TransformChangeType.REMOVED:
						transformEvents.push(event)
						break
					case TransformChangeType.UPDATED:
						if (
							event.transform.physicalObject.geometryType.value.pointCloud !== undefined ||
							event.transform.physicalObject.geometryType.value.header !== undefined
						) {
							const pointCloud = pointClouds[event.transform.uuidString]
							if (!pointCloud) continue

							const t = event.transform as TransformWithUUID
							const data = getPointCloud(t)
							const header = getPointCloudHeader(t)
							if (data || header) {
								pointCloud.enqueueUpdate(header, data ?? new Uint8Array(0))
							}
						}

						const cleanedEvent = omit(
							event,
							'transform.physicalObject.geometryType.value.pointCloud',
							'transform.physicalObject.geometryType.value.header'
						)
						transformEvents.push(cleanedEvent)
						break
				}
			} else {
				transformEvents.push(event)
			}
		}

		if (transformEvents.length > 0) {
			worker.postMessage({ type: 'change', events: transformEvents })
			queryClient.setQueryData(
				streamQueryKey(partID(), resourceName(), 'streamTransformChanges'),
				[]
			)
		}
	})

	return {
		get name() {
			return resourceName()
		},
		get worldObjects() {
			return Object.values(transforms)
		},
		get pointClouds() {
			return Object.values(pointClouds)
		},
	}
}
