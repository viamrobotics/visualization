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

import { writeBufferGeometryRange } from '$lib/attribute'
import { ColorFormat } from '$lib/buf/draw/v1/metadata_pb'
import { asFloat32Array, inMeters } from '$lib/buffer'
import { drawTransform } from '$lib/draw'
import { traits, useWorld } from '$lib/ecs'
import { createBox, createCapsule, createSphere } from '$lib/geometry'
import { isPointCloud } from '$lib/geometry'
import { metadataFromStruct } from '$lib/metadata'
import { parsePlyInput } from '$lib/ply'
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

const waitForFrame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))

/**
 * Decodes a base64-encoded string into a Uint8Array.
 */
const decodeBase64 = (encoded: string): Uint8Array => {
	const binary = atob(encoded)
	const bytes = new Uint8Array(binary.length)
	for (let i = 0; i < binary.length; i++) {
		bytes[i] = binary.charCodeAt(i)
	}
	return bytes
}

const createWorldState = (client: { current: WorldStateStoreClient | undefined }) => {
	const { invalidate } = useThrelte()
	const world = useWorld()

	const entities = new Map<string, Entity>()
	const activeChunkPulls = new Set<string>()
	const chunkAbortController = new AbortController()

	const spawnEntity = (transform: TransformWithUUID) => {
		if (entities.has(transform.uuidString)) {
			return
		}

		const entity = drawTransform(world, transform, traits.WorldStateStoreAPI, { removable: false })
		entities.set(transform.uuidString, entity)

		const parsedMetadata = metadataFromStruct(transform.metadata?.fields)
		const chunks = parsedMetadata.chunks

		if (chunks && chunks.total > 0) {
			const chunkElements = chunks.chunkSize

			entity.add(traits.ChunkProgress({ loaded: chunkElements, total: chunks.total }))

			void pullChunks(
				transform.uuidString,
				entity,
				chunks.total,
				chunkElements,
				chunkAbortController.signal
			)
		}

		if (isPointCloud(transform.physicalObject?.geometryType)) invalidate()
	}

	/**
	 * Pulls remaining chunks for a chunked entity via DoCommand.
	 *
	 * TODO: Document the DoCommand contract for service implementors.
	 * The expected request format is:
	 *   { "command": "get_entity_chunk", "uuid": "<uuid-string>", "start": <element-offset> }
	 * The expected response format is:
	 *   { "positions": "<base64 Float32Array>", "colors": "<base64 Uint8Array>" (optional),
	 *     "opacities": "<base64 Uint8Array>" (optional), "start": <number>, "done": <boolean> }
	 */
	const pullChunks = async (
		uuid: string,
		entity: Entity,
		totalElements: number,
		firstChunkEnd: number,
		signal: AbortSignal
	) => {
		if (activeChunkPulls.has(uuid)) return
		activeChunkPulls.add(uuid)

		try {
			let nextStart = firstChunkEnd
			while (!signal.aborted) {
				const activeClient = client.current
				if (!activeClient) break

				const response = await activeClient.doCommand(
					Struct.fromJson({
						command: 'get_entity_chunk',
						uuid,
						start: nextStart,
					})
				)

				if (signal.aborted) break

				const fields = response as Record<string, unknown>
				const done = fields['done'] === true

				const encodedPositions = fields['positions']
				if (typeof encodedPositions !== 'string' || encodedPositions.length === 0) {
					if (done) break
					continue
				}

				const buffer = entity.get(traits.BufferGeometry)
				if (!buffer) break

				const bytes = decodeBase64(encodedPositions)
				const positions = asFloat32Array(bytes, inMeters)
				const start = typeof fields['start'] === 'number' ? fields['start'] : nextStart

				const encodedColors = fields['colors']
				const colors =
					typeof encodedColors === 'string' && encodedColors.length > 0
						? decodeBase64(encodedColors)
						: undefined

				const encodedOpacities = fields['opacities']
				const opacities =
					typeof encodedOpacities === 'string' && encodedOpacities.length > 0
						? decodeBase64(encodedOpacities)
						: undefined

				writeBufferGeometryRange(buffer, positions, start, {
					colorFormat: ColorFormat.RGB,
					colors,
					opacities,
				})

				const chunkElements = positions.length / 3
				nextStart = start + chunkElements
				entity.set(traits.ChunkProgress, { loaded: nextStart, total: totalElements })
				invalidate()

				if (done) break

				await waitForFrame()
			}
		} catch (error) {
			if (!signal.aborted) {
				console.error(`Chunk pull failed for entity ${uuid}:`, error)
			}
		} finally {
			activeChunkPulls.delete(uuid)
			if (world.has(entity)) {
				entity.remove(traits.ChunkProgress)
			}
		}
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

		for (const path of changes) {
			if (typeof path === 'string') {
				if (path.startsWith('poseInObserverFrame.pose')) {
					entity.set(traits.Pose, transform.poseInObserverFrame?.pose ?? createPose())
				} else if (path.startsWith('physicalObject') && transform.physicalObject) {
					const { geometryType } = transform.physicalObject

					if (geometryType.case === 'box') {
						entity.set(traits.Box, createBox(geometryType.value))
					} else if (geometryType.case === 'capsule') {
						entity.set(traits.Capsule, createCapsule(geometryType.value))
					} else if (geometryType.case === 'sphere') {
						entity.set(traits.Sphere, createSphere(geometryType.value))
					} else if (geometryType.case === 'mesh') {
						entity.set(traits.BufferGeometry, parsePlyInput(geometryType.value.mesh))
					}
				}
			}
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
		chunkAbortController.abort()
		for (const [, entity] of entities) {
			if (world.has(entity)) {
				entity.destroy()
			}
		}
	}
}
