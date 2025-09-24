import {
	WorldStateStoreClient,
	TransformChangeType,
	type TransformWithUUID,
	ResourceName,
	PointCloud,
} from '@viamrobotics/sdk'
import {
	createResourceClient,
	createResourceQuery,
	createResourceStream,
	streamQueryKey,
	useResourceNames,
} from '@viamrobotics/svelte-sdk'
import { useQueryClient } from '@tanstack/svelte-query'
import { usePartID } from './usePartID.svelte'
import { getInUnsafe, setInUnsafe } from '@thi.ng/paths'
import { postChangeMessage, type ProcessMessage } from '$lib/world-state-messages'
import { getContext, setContext } from 'svelte'
import WorldStateWorker from '../workers/worldStateWorker?worker'
import { getPointcloudManager, type PointCloudLoadResult } from '$lib/wasm/pointcloud-manager'
import {
	fromPointCloudTransform,
	fromTransform,
	parseMetadata,
	type PointCloudTransform,
} from '$lib/WorldObject.svelte'

const key = Symbol('world-state-context')

interface Context {
	names: ResourceName[]
	current: Record<string, ReturnType<typeof createWorldState>>
}

type PointCloudTransformWithUUID = TransformWithUUID & {
	physicalObject: { geometryType: { case: 'pointcloud'; value: PointCloud } }
}

const isPointCloudTransformWithUUID = (
	transform: TransformWithUUID
): transform is PointCloudTransformWithUUID => {
	return transform.physicalObject?.geometryType.case === 'pointcloud'
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

	const transforms = $state<Record<string, TransformWithUUID>>({})
	const pointclouds = $state<Record<string, PointCloudTransform>>({})

	const transformsList = $derived.by(() => Object.values(transforms).map(fromTransform))
	const pointcloudsList = $derived.by(() => Object.values(pointclouds).map(fromPointCloudTransform))

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

	const loadingUUIDs = $derived(listUUIDs.current.isLoading)
	const loadingTransforms = $derived(getTransforms?.some((query) => query.current?.isLoading))

	const changeStream = createResourceStream(client, 'streamTransformChanges', {
		refetchMode: 'replace',
	})

	const loadPointcloud = async (transform: TransformWithUUID) => {
		if (!isPointCloudTransformWithUUID(transform)) return

		const pointcloudData = transform.physicalObject.geometryType.value.pointCloud
		if (!pointcloudData || pointcloudData.length === 0) return

		try {
			const manager = getPointcloudManager()
			// IMPORTANT: Don't skip colors for initial load - we need to extract them from PCD data
			// The backend provides PCD data with colors embedded, not separate color arrays
			const result = await manager.loadPointcloud(
				transform.uuidString,
				pointcloudData,
				parseMetadata(transform.metadata?.fields ?? {})
			)

			// Store the processed pointcloud with the original transform data
			const processedPointcloud: PointCloudTransform = {
				...transform,
				positions: result.positions,
				colors: result.colors,
				pointCount: result.pointCount,
				updateVersion: 0,
			}

			pointclouds[transform.uuidString] = processedPointcloud
		} catch (error) {
			console.error(`Failed to load pointcloud ${transform.uuidString}:`, error)
		}
	}

	const updatePointcloud = async (
		event: ProcessMessage['events'][0] & { type: TransformChangeType.UPDATED }
	) => {
		const existingPointcloud = pointclouds[event.uuidString]
		if (!existingPointcloud) return

		const deltaFormat = event.transform.metadata?.fields?.pointCloudDeltaFormat?.kind?.value
		if (deltaFormat === 'index_x_y_z') {
			try {
				const geometryValue = event.transform.physicalObject?.geometryType?.value
				const deltaData = (geometryValue as any)?.pointCloud
				if (deltaData && deltaData.length > 0) {
					const manager = getPointcloudManager()

					const result = await manager.updatePointcloud(
						event.uuidString,
						deltaData,
						'index_x_y_z',
						existingPointcloud.positions,
						existingPointcloud.colors || undefined
					)

					// Handle position updates
					if (result.updatedInPlace) {
						const newVersion = existingPointcloud.updateVersion + 1
						existingPointcloud.updateVersion = newVersion
					} else {
						if (
							existingPointcloud.positions &&
							result.positions.length === existingPointcloud.positions.length
						) {
							existingPointcloud.positions.set(result.positions)
						} else {
							existingPointcloud.positions = result.positions
						}

						const newVersion = (existingPointcloud.updateVersion || 0) + 1
						existingPointcloud.updateVersion = newVersion
					}

					existingPointcloud.pointCount = result.pointCount
				}
			} catch (error) {
				console.error(`Failed to update pointcloud ${event.uuidString}:`, error)
			}
		} else {
			// For non-delta updates, reload the entire pointcloud
			if (isPointCloudTransformWithUUID(event.transform)) {
				await loadPointcloud(event.transform)
			}
		}
	}

	const removePointcloud = async (uuid: string) => {
		try {
			const manager = getPointcloudManager()
			await manager.disposePointcloud(uuid)
			delete pointclouds[uuid]
		} catch (error) {
			console.error(`Failed to remove pointcloud ${uuid}:`, error)
		}
	}

	const initialize = (initial: TransformWithUUID[]) => {
		for (const transform of initial) {
			if (transform.physicalObject?.geometryType.case === 'pointcloud') {
				void loadPointcloud(transform)
			} else {
				transforms[transform.uuidString] = transform
			}
		}
	}

	const applyEvents = (events: ProcessMessage['events']) => {
		for (const event of events) {
			switch (event.type) {
				case TransformChangeType.ADDED:
					if (event.transform.physicalObject?.geometryType.case === 'pointcloud') {
						void loadPointcloud(event.transform)
					} else {
						transforms[event.uuidString] = event.transform
					}
					break
				case TransformChangeType.REMOVED:
					if (pointclouds[event.uuidString]) {
						void removePointcloud(event.uuidString)
					} else {
						delete transforms[event.uuidString]
					}
					break
				case TransformChangeType.UPDATED: {
					if (event.changes.length === 0) continue
					if (event.transform.physicalObject?.geometryType.case === 'pointcloud') {
						void updatePointcloud(event)
					} else {
						if (!transforms[event.uuidString]) continue
						for (const paths of event.changes) {
							const next = getInUnsafe(event.transform, paths)
							transforms[event.uuidString] = setInUnsafe(transforms[event.uuidString], paths, next)
						}
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
			applyEvents(toApply)
			flushScheduled = false
			pendingEvents = []
		})
	}

	$effect(() => {
		if (loadingUUIDs || loadingTransforms) return
		const queries = (getTransforms ?? []).map((query) => query.current)
		const data = queries
			.flatMap((query) => query?.data ?? [])
			.filter((transform) => transform !== undefined) as TransformWithUUID[]

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
			const manager = getPointcloudManager()
			for (const uuid of Object.keys(pointclouds)) {
				void manager.disposePointcloud(uuid).catch((error) => {
					console.warn(`Failed to cleanup pointcloud ${uuid}:`, error)
				})
			}

			worker.terminate()
		}
	})

	$effect.pre(() => {
		if (loadingUUIDs || loadingTransforms) return
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
		get pointclouds() {
			return pointcloudsList
		},
	}
}
