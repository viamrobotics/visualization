import type { Entity } from 'koota'

import { useThrelte } from '@threlte/core'
import {
	Struct,
	type TransformChangeEvent,
	TransformChangeType,
	type TransformWithUUID,
	WorldStateStoreClient,
} from '@viamrobotics/sdk'
import {
	createResourceClient,
	createResourceQuery,
	createResourceStream,
	useResourceNames,
} from '@viamrobotics/svelte-sdk'

import { asFloat32Array, inMeters } from '$lib/buffer'
import { createChunkLoader, type EntityChunk } from '$lib/chunking'
import { drawTransform, updateMetadata } from '$lib/draw'
import { traits, useWorld } from '$lib/ecs'
import { isPointCloud } from '$lib/geometry'
import { metadataFromStruct } from '$lib/metadata'
import { createPose } from '$lib/transform'

import { usePartID } from './usePartID.svelte'

type TransformEvent = TransformChangeEvent & {
	transform: TransformWithUUID
}

export const provideWorldStates = () => {
	const partID = usePartID()
	const resourceNames = useResourceNames(() => partID.current, 'world_state_store')
	const clients = $derived(
		resourceNames.current.map(({ name }) =>
			createResourceClient(
				WorldStateStoreClient,
				() => partID.current,
				() => name
			)
		)
	)

	$effect(() => {
		const cleanups: (() => void)[] = []

		for (const client of clients) {
			cleanups.push(createWorldState(client))
		}

		return () => {
			for (const cleanup of cleanups) {
				cleanup()
			}
		}
	})
}

const decodeBase64 = (encoded: string): Uint8Array => {
	const binary = atob(encoded)
	const bytes = new Uint8Array(binary.length)
	for (let i = 0; i < binary.length; i++) {
		bytes[i] = binary.charCodeAt(i)
	}
	return bytes
}

/**
 * Unpacks a `get_entity_chunk` DoCommand response into the shape the shared
 * chunk loader expects. The world-state store sends binary buffers as base64
 * strings inside a JSON `Struct`, which is why this adapter exists.
 *
 * Request:
 *   { "command": "get_entity_chunk", "uuid": "<uuid-string>", "start": <element-offset> }
 *
 * Response:
 *   {
 *     "entity": {
 *       "metadata": {
 *         "colors":    "<base64 Uint8Array>" (optional),
 *         "opacities": "<base64 Uint8Array>" (optional)
 *       },
 *       "physical_object": {
 *         "points": { "positions": "<base64 Float32Array>" }
 *       }
 *     },
 *     "start": <number>,
 *     "done":  <boolean>
 *   }
 */
const decodeWorldStateChunk = (response: unknown, fallbackStart: number): EntityChunk | null => {
	const fields = response as Record<string, unknown>
	const done = fields['done'] === true
	const start = typeof fields['start'] === 'number' ? fields['start'] : fallbackStart

	const chunkEntity = fields['entity'] as Record<string, unknown> | undefined
	if (!chunkEntity) return null

	const physicalObject = chunkEntity['physical_object'] as Record<string, unknown> | undefined
	const points = physicalObject?.['points'] as Record<string, unknown> | undefined
	const encodedPositions = points?.['positions']
	if (typeof encodedPositions !== 'string' || encodedPositions.length === 0) return null

	const positions = asFloat32Array(decodeBase64(encodedPositions), inMeters)

	const metadata = chunkEntity['metadata'] as Record<string, unknown> | undefined
	const encodedColors = metadata?.['colors']
	const colors =
		typeof encodedColors === 'string' && encodedColors.length > 0
			? decodeBase64(encodedColors)
			: undefined

	const encodedOpacities = metadata?.['opacities']
	const opacities =
		typeof encodedOpacities === 'string' && encodedOpacities.length > 0
			? decodeBase64(encodedOpacities)
			: undefined

	return { start, positions, colors, opacities, done }
}

const createWorldState = (client: { current: WorldStateStoreClient | undefined }) => {
	const { invalidate } = useThrelte()
	const world = useWorld()

	const entities = new Map<string, Entity>()

	const chunkLoader = createChunkLoader({
		world,
		invalidate,
		fetchChunk: async (uuid, start, signal) => {
			const activeClient = client.current
			if (!activeClient) return null

			const response = await activeClient.doCommand(
				Struct.fromJson({
					command: 'get_entity_chunk',
					uuid,
					start,
				})
			)

			if (signal.aborted) return null

			return decodeWorldStateChunk(response, start)
		},
	})

	const spawnEntity = (transform: TransformWithUUID) => {
		if (entities.has(transform.uuidString)) {
			return
		}

		const entity = drawTransform(world, transform, traits.WorldStateStoreAPI, { removable: false })
		entities.set(transform.uuidString, entity)

		const parsedMetadata = metadataFromStruct(transform.metadata?.fields)
		chunkLoader.start(transform.uuidString, entity, parsedMetadata)

		if (isPointCloud(transform.physicalObject?.geometryType)) invalidate()
	}

	const destroyEntity = (uuid: string) => {
		const entity = entities.get(uuid)

		if (!entity) return

		if (world.has(entity)) {
			entity.destroy()
		}
		entities.delete(uuid)
	}

	const updateEntity = (transform: TransformWithUUID, changes: (string | number)[]) => {
		const entity = entities.get(transform.uuidString)

		if (!entity) return

		let metadataDirty = false

		for (const path of changes) {
			if (typeof path === 'string') {
				if (path.startsWith('poseInObserverFrame.pose')) {
					entity.set(traits.Pose, transform.poseInObserverFrame?.pose ?? createPose())
				} else if (path.startsWith('physicalObject') && transform.physicalObject) {
					traits.updateGeometryTrait(entity, transform.physicalObject)
				} else if (path.startsWith('metadata')) {
					metadataDirty = true
				}
			}
		}

		if (metadataDirty) {
			updateMetadata(entity, metadataFromStruct(transform.metadata?.fields), {
				pointCloud: isPointCloud(transform.physicalObject?.geometryType),
			})
		}
	}

	let initialized = false
	let flushScheduled = false
	let pendingEvents: TransformEvent[] = []

	const listUUIDs = createResourceQuery(client, 'listUUIDs')
	const getTransformQueries = $derived(
		listUUIDs.data?.map((uuid) => {
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

	const applyEvents = (events: TransformEvent[]) => {
		for (const event of events) {
			if (event.changeType === TransformChangeType.ADDED) {
				spawnEntity(event.transform)
			} else if (event.changeType === TransformChangeType.REMOVED) {
				destroyEntity(event.transform.uuidString)
			} else if (event.changeType === TransformChangeType.UPDATED) {
				updateEntity(event.transform, event.updatedFields?.paths ?? [])
			} else {
				console.error('Unspecified change type.', event)
			}
		}

		invalidate()
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
		if (!getTransformQueries) return
		if (initialized) return
		if (getTransformQueries.some((query) => query?.isLoading)) return

		const transforms = getTransformQueries
			.flatMap((query) => query?.data)
			.filter((transform) => transform !== undefined)

		for (const transform of transforms) {
			spawnEntity(transform)
		}

		invalidate()
		initialized = true
	})

	$effect(() => {
		if (changeStream?.data === undefined) return

		const eventsByUUID = new Map<string, TransformEvent>()

		for (const event of changeStream.data) {
			if (!event.transform) {
				continue
			}

			const uuid = event.transform.uuidString
			const existing = eventsByUUID.get(uuid)
			if (!existing) {
				eventsByUUID.set(uuid, event as TransformEvent)
				continue
			}

			switch (event.changeType) {
				case TransformChangeType.REMOVED: {
					eventsByUUID.set(uuid, event as TransformEvent)
					break
				}

				case TransformChangeType.ADDED: {
					if (existing.changeType !== TransformChangeType.REMOVED) {
						eventsByUUID.set(uuid, event as TransformEvent)
					}
					break
				}

				case TransformChangeType.UPDATED: {
					// merge with existing updated event
					if (existing.changeType === TransformChangeType.UPDATED) {
						existing.updatedFields ??= { paths: [] }

						const paths = event.updatedFields?.paths ?? []

						for (const path of paths) {
							if (existing.updatedFields.paths.includes(path)) {
								continue
							}

							existing.updatedFields.paths.push(path)
						}

						existing.transform = event.transform
					} else {
						eventsByUUID.set(uuid, event as TransformEvent)
					}
					break
				}
			}
		}

		pendingEvents.push(...eventsByUUID.values())
		scheduleFlush()
	})

	return () => {
		chunkLoader.dispose()
		for (const [, entity] of entities) {
			if (world.has(entity)) {
				entity.destroy()
			}
		}
	}
}
