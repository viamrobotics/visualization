import { FieldMask } from '@bufbuild/protobuf'
import { type Client, createClient } from '@connectrpc/connect'
import { createConnectTransport } from '@connectrpc/connect-web'
import { useThrelte } from '@threlte/core'
import { type Entity } from 'koota'
import { getContext, setContext } from 'svelte'
import { UuidTool } from 'uuid-tool'

import type { Drawing } from '$lib/buf/draw/v1/drawing_pb'
import type { Relationship } from '$lib/buf/draw/v1/metadata_pb'

import { writeBufferGeometryRange } from '$lib/attribute'
import { DrawService } from '$lib/buf/draw/v1/service_connect'
import {
	CreateRelationshipRequest,
	DeleteRelationshipRequest,
	EntityChangeType,
	StreamEntityChangesResponse,
} from '$lib/buf/draw/v1/service_pb'
import { asFloat32Array, inMeters, STRIDE } from '$lib/buffer'
import {
	drawDrawing,
	drawTransform,
	type Transform,
	updateDrawing,
	updateModel,
	updateTransform,
	uuidStringToBytes,
} from '$lib/draw'
import { traits, useWorld } from '$lib/ecs'
import { retryStream } from '$lib/retry-stream'

import { useCameraControls } from './useControls.svelte'
import { useDrawConnectionConfig } from './useDrawConnectionConfig.svelte'
import { useRelationships } from './useRelationships.svelte'

const DRAW_SERVICE_KEY = Symbol('draw-service-context')
const FLOAT32_SIZE = 4

const ConnectionStatus = {
	CONNECTED: 'connected',
	DISCONNECTED: 'disconnected',
	CONNECTING: 'connecting',
} as const

type ConnectionStatusType = (typeof ConnectionStatus)[keyof typeof ConnectionStatus]

interface Context {
	connectionStatus: ConnectionStatusType
	createRelationship: (
		sourceUuid: string,
		targetUuid: string,
		type: string,
		indexMapping?: string
	) => Promise<void>
	deleteRelationship: (sourceUuid: string, targetUuid: string) => Promise<void>
}

interface StreamEvent {
	uuid: string
	changeType: EntityChangeType
	entity: StreamEntityChangesResponse['entity']
	updatedFields?: FieldMask
}

export function provideDrawService() {
	const { invalidate } = useThrelte()
	const world = useWorld()
	const cameraControls = useCameraControls()
	const drawConnectionConfig = useDrawConnectionConfig()
	const relationships = useRelationships()

	let connectionStatus = $state<ConnectionStatusType>(ConnectionStatus.DISCONNECTED)

	const url = $derived(
		drawConnectionConfig.current?.backendIP
			? `http://${drawConnectionConfig.current.backendIP}:3030`
			: undefined
	)

	const transformEntities = new Map<string, Entity>()
	const drawingEntities = new Map<string, Entity>()

	let pendingEvents: StreamEvent[] = []
	let flushScheduled = false
	let activeClient: Client<typeof DrawService> | undefined
	let activeSignal: AbortSignal | undefined
	const activeChunkPulls = new Set<string>()

	const destroyTransform = (uuidStr: string) => {
		const entity = transformEntities.get(uuidStr)
		if (!entity) return
		if (world.has(entity)) entity.destroy()
		transformEntities.delete(uuidStr)
	}

	const destroyDrawing = (uuidStr: string) => {
		const entity = drawingEntities.get(uuidStr)
		if (!entity) return
		if (world.has(entity)) entity.destroy()
		drawingEntities.delete(uuidStr)
	}

	const processEvent = (event: StreamEvent) => {
		const { changeType, entity, uuid } = event

		if (entity.case === 'transform') {
			processTransformEvent(entity.value, changeType, uuid)
		} else if (entity.case === 'drawing') {
			processDrawingEvent(entity.value, changeType, uuid)
		}

		invalidate()
	}

	const processTransformEvent = (
		transform: Transform,
		changeType: EntityChangeType,
		uuid: string
	) => {
		if (changeType === EntityChangeType.ADDED) {
			if (!transformEntities.has(uuid)) {
				const spawned = drawTransform(world, transform, traits.DrawServiceAPI)
				relationships.apply(spawned.entity, spawned.relationships)
				transformEntities.set(uuid, spawned.entity)
				relationships.flush(uuid)
			}
		} else if (changeType === EntityChangeType.REMOVED) {
			destroyTransform(uuid)
		} else if (changeType === EntityChangeType.UPDATED) {
			const existing = transformEntities.get(uuid)
			if (existing) {
				const updated = updateTransform(existing, transform)
				relationships.apply(updated.entity, updated.relationships)
			} else {
				const spawned = drawTransform(world, transform, traits.DrawServiceAPI)
				relationships.apply(spawned.entity, spawned.relationships)
				transformEntities.set(uuid, spawned.entity)
				relationships.flush(uuid)
			}
		}
	}

	const isChunkedDrawing = (drawing: Drawing): boolean => {
		return drawing.metadata?.chunks !== undefined && drawing.metadata.chunks.total > 0
	}

	const getChunkInfo = (drawing: Drawing): { total: number; firstEnd: number } | undefined => {
		const meta = drawing.metadata?.chunks
		if (!meta || meta.total === 0) return undefined

		const shape = drawing.physicalObject?.geometryType
		if (shape?.case === 'points') {
			const chunkElements = shape.value.positions.length / (STRIDE.POSITIONS * FLOAT32_SIZE)
			return {
				total: meta.total,
				firstEnd: chunkElements,
			}
		}
		return undefined
	}

	const pullChunks = async (
		client: Client<typeof DrawService>,
		uuid: string,
		uuidBytes: Uint8Array,
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
				const response = await client.getEntityChunk(
					{ uuid: uuidBytes as Uint8Array<ArrayBuffer>, start: nextStart },
					{ signal }
				)

				// done with no payload is the server's "past end" sentinel (startByte >= posLen), not the final real chunk
				if (response.done && !response.entity.value) break

				const drawing = response.entity.case === 'drawing' ? response.entity.value : undefined
				if (!drawing) break

				const shape = drawing.physicalObject?.geometryType
				if (shape?.case !== 'points') break

				const buffer = entity.get(traits.BufferGeometry)
				if (!buffer) break

				const positions = asFloat32Array(shape.value.positions, inMeters)
				const metadata = drawing.metadata
				if (!metadata) break

				writeBufferGeometryRange(buffer, positions, response.start, metadata)

				const chunkElements = positions.length / 3
				nextStart = response.start + chunkElements
				entity.set(traits.ChunkProgress, { loaded: nextStart, total: totalElements })
				invalidate()

				if (response.done) break
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

	const processDrawingEvent = (drawing: Drawing, changeType: EntityChangeType, uuid: string) => {
		if (changeType === EntityChangeType.ADDED) {
			if (!drawingEntities.has(uuid)) {
				const spawned = drawDrawing(world, drawing, traits.DrawServiceAPI)
				relationships.apply(spawned.entity, spawned.relationships)
				drawingEntities.set(uuid, spawned.entity)
				relationships.flush(uuid)

				if (isChunkedDrawing(drawing) && activeClient && activeSignal) {
					const chunk = getChunkInfo(drawing)
					if (chunk) {
						spawned.entity.add(traits.ChunkProgress({ loaded: chunk.firstEnd, total: chunk.total }))
						const uuidBytes = drawing.uuid ?? new Uint8Array()
						void pullChunks(
							activeClient,
							uuid,
							uuidBytes,
							spawned.entity,
							chunk.total,
							chunk.firstEnd,
							activeSignal
						)
					}
				}
			}
		} else if (changeType === EntityChangeType.REMOVED) {
			destroyDrawing(uuid)
		} else if (changeType === EntityChangeType.UPDATED) {
			const existing = drawingEntities.get(uuid)
			if (existing) {
				const isModel = drawing.physicalObject?.geometryType?.case === 'model'
				const result = isModel
					? updateModel(world, existing, drawing, traits.DrawServiceAPI)
					: updateDrawing(world, existing, drawing)
				relationships.apply(result.entity, result.relationships)
				drawingEntities.set(uuid, result.entity)
			} else {
				const spawned = drawDrawing(world, drawing, traits.DrawServiceAPI)
				relationships.apply(spawned.entity, spawned.relationships)
				drawingEntities.set(uuid, spawned.entity)
				relationships.flush(uuid)
			}
		}
	}

	const applyEvents = (events: StreamEvent[]) => {
		const eventsByUUID = new Map<string, StreamEvent>()

		for (const event of events) {
			const existing = eventsByUUID.get(event.uuid)
			if (!existing) {
				eventsByUUID.set(event.uuid, event)
				continue
			}

			switch (event.changeType) {
				case EntityChangeType.REMOVED: {
					eventsByUUID.set(event.uuid, event)
					break
				}
				case EntityChangeType.ADDED: {
					if (existing.changeType !== EntityChangeType.REMOVED) {
						eventsByUUID.set(event.uuid, event)
					}
					break
				}
				case EntityChangeType.UPDATED: {
					if (existing.changeType === EntityChangeType.ADDED) {
						existing.entity = event.entity
					} else if (existing.changeType === EntityChangeType.UPDATED) {
						existing.updatedFields ??= new FieldMask()
						const paths = event.updatedFields?.paths ?? []
						for (const path of paths) {
							if (!existing.updatedFields.paths.includes(path)) {
								existing.updatedFields.paths.push(path)
							}
						}
						existing.entity = event.entity
					} else {
						eventsByUUID.set(event.uuid, event)
					}
					break
				}
			}
		}

		for (const event of eventsByUUID.values()) {
			processEvent(event)
		}
	}

	const scheduleFlush = () => {
		if (flushScheduled) return
		flushScheduled = true

		requestAnimationFrame(() => {
			flushScheduled = false
			const toApply = pendingEvents
			pendingEvents = []
			applyEvents(toApply)
		})
	}

	const streamEntityChanges = async (client: Client<typeof DrawService>, signal: AbortSignal) => {
		await retryStream(
			async (sig) => {
				for await (const response of client.streamEntityChanges({}, { signal: sig })) {
					connectionStatus = ConnectionStatus.CONNECTED

					const { entity } = response
					if (!entity.case) continue

					const uuid = UuidTool.toString([...(entity.value.uuid ?? [])])
					pendingEvents.push({
						uuid,
						changeType: response.changeType,
						entity,
						updatedFields: response.updatedFields,
					})
					scheduleFlush()
				}
			},
			signal,
			() => {
				connectionStatus = ConnectionStatus.DISCONNECTED
			}
		)
	}

	const streamSceneChanges = async (client: Client<typeof DrawService>, signal: AbortSignal) => {
		await retryStream(async (sig) => {
			for await (const response of client.streamSceneChanges({}, { signal: sig })) {
				const { sceneMetadata } = response
				if (!sceneMetadata) continue

				if (sceneMetadata.sceneCamera?.position && sceneMetadata.sceneCamera?.lookAt) {
					const { position, lookAt, animated } = sceneMetadata.sceneCamera
					cameraControls.setPose(
						{
							position: [position.x * 0.001, position.y * 0.001, position.z * 0.001],
							lookAt: [lookAt.x * 0.001, lookAt.y * 0.001, lookAt.z * 0.001],
						},
						animated ?? false
					)
				}
			}
		}, signal)
	}

	const createRelationship = async (
		sourceUuid: string,
		targetUuid: string,
		type: string,
		indexMapping?: string
	): Promise<void> => {
		if (!activeClient) return
		const rel: Partial<Relationship> = {
			targetUuid: uuidStringToBytes(targetUuid),
			type,
		}
		if (indexMapping !== undefined) {
			rel.indexMapping = indexMapping
		}
		await activeClient.createRelationship(
			new CreateRelationshipRequest({
				sourceUuid: uuidStringToBytes(sourceUuid),
				relationship: rel,
			})
		)
	}

	const deleteRelationship = async (sourceUuid: string, targetUuid: string): Promise<void> => {
		if (!activeClient) return
		await activeClient.deleteRelationship(
			new DeleteRelationshipRequest({
				sourceUuid: uuidStringToBytes(sourceUuid),
				targetUuid: uuidStringToBytes(targetUuid),
			})
		)
	}

	$effect(() => {
		if (!url) {
			connectionStatus = ConnectionStatus.DISCONNECTED
			activeClient = undefined
			return
		}

		const controller = new AbortController()
		connectionStatus = ConnectionStatus.CONNECTING

		const transport = createConnectTransport({ baseUrl: url })
		const client = createClient(DrawService, transport)
		activeClient = client
		activeSignal = controller.signal

		void streamEntityChanges(client, controller.signal)
		void streamSceneChanges(client, controller.signal)

		return () => {
			controller.abort()
			activeClient = undefined
			activeSignal = undefined
			connectionStatus = ConnectionStatus.DISCONNECTED
			activeClient = undefined

			for (const entity of transformEntities.values()) {
				if (world.has(entity)) entity.destroy()
			}
			transformEntities.clear()

			for (const entity of drawingEntities.values()) {
				if (world.has(entity)) entity.destroy()
			}
			drawingEntities.clear()
			relationships.clear()
		}
	})

	setContext<Context>(DRAW_SERVICE_KEY, {
		get connectionStatus() {
			return connectionStatus
		},
		createRelationship,
		deleteRelationship,
	})
}

export function useDrawService(): Context {
	return getContext<Context>(DRAW_SERVICE_KEY)
}
