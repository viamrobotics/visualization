import { FieldMask } from '@bufbuild/protobuf'
import { type Client, createClient } from '@connectrpc/connect'
import { createConnectTransport } from '@connectrpc/connect-web'
import { useThrelte } from '@threlte/core'
import { type Entity } from 'koota'
import { getContext, setContext } from 'svelte'
import { UuidTool } from 'uuid-tool'

import type { Drawing } from '$lib/buf/draw/v1/drawing_pb'

import { writeBufferGeometryRange } from '$lib/attribute'
import { DrawService } from '$lib/buf/draw/v1/service_connect'
import { EntityChangeType, StreamEntityChangesResponse } from '$lib/buf/draw/v1/service_pb'
import { asFloat32Array, inMeters, STRIDE } from '$lib/buffer'
import {
	drawDrawing,
	drawTransform,
	type Transform,
	updateDrawing,
	updateTransform,
} from '$lib/draw'
import { traits, useWorld } from '$lib/ecs'

import { useCameraControls } from './useControls.svelte'
import { useDrawConnectionConfig } from './useDrawConnectionConfig.svelte'

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

	let connectionStatus = $state<ConnectionStatusType>(ConnectionStatus.DISCONNECTED)

	const url = $derived(
		drawConnectionConfig.current?.backendIP
			? `http://${drawConnectionConfig.current.backendIP}:3030`
			: undefined
	)

	const transformEntities = new Map<string, Entity>()
	const drawingEntities = new Map<string, Entity[]>()

	let pendingEvents: StreamEvent[] = []
	let flushScheduled = false

	const destroyTransform = (uuidStr: string) => {
		const entity = transformEntities.get(uuidStr)
		if (!entity) return
		if (world.has(entity)) entity.destroy()
		transformEntities.delete(uuidStr)
	}

	const destroyDrawing = (uuidStr: string) => {
		const entities = drawingEntities.get(uuidStr)
		if (!entities) return
		for (const entity of entities) {
			if (world.has(entity)) entity.destroy()
		}
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
				transformEntities.set(uuid, spawned)
			}
		} else if (changeType === EntityChangeType.REMOVED) {
			destroyTransform(uuid)
		} else if (changeType === EntityChangeType.UPDATED) {
			const existing = transformEntities.get(uuid)
			if (existing) {
				updateTransform(existing, transform)
			} else {
				const spawned = drawTransform(world, transform, traits.DrawServiceAPI)
				transformEntities.set(uuid, spawned)
			}
		}
	}

	let activeClient: Client<typeof DrawService> | undefined
	let activeSignal: AbortSignal | undefined
	const activeChunkPulls = new Set<string>()

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

	const waitForFrame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))

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

	const processDrawingEvent = (drawing: Drawing, changeType: EntityChangeType, uuid: string) => {
		if (changeType === EntityChangeType.ADDED) {
			if (!drawingEntities.has(uuid)) {
				const spawned = drawDrawing(world, drawing, traits.DrawServiceAPI)
				drawingEntities.set(uuid, spawned)

				if (isChunkedDrawing(drawing) && activeClient && activeSignal) {
					const chunk = getChunkInfo(drawing)
					if (chunk) {
						spawned[0]!.add(traits.ChunkProgress({ loaded: chunk.firstEnd, total: chunk.total }))
						const uuidBytes = drawing.uuid ?? new Uint8Array()
						void pullChunks(
							activeClient,
							uuid,
							uuidBytes,
							spawned[0]!,
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
				const next = updateDrawing(world, existing, drawing, traits.DrawServiceAPI)
				drawingEntities.set(uuid, next)
			} else {
				const spawned = drawDrawing(world, drawing, traits.DrawServiceAPI)
				drawingEntities.set(uuid, spawned)
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
		try {
			for await (const response of client.streamEntityChanges({}, { signal })) {
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
		} catch (error) {
			if (!signal.aborted) {
				console.error('Draw service entity stream error:', error)
				connectionStatus = ConnectionStatus.DISCONNECTED
			}
		}
	}

	const streamSceneChanges = async (client: Client<typeof DrawService>, signal: AbortSignal) => {
		try {
			for await (const response of client.streamSceneChanges({}, { signal })) {
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
		} catch (error) {
			if (!signal.aborted) {
				console.error('Draw service scene stream error:', error)
			}
		}
	}

	$effect(() => {
		if (!url) {
			connectionStatus = ConnectionStatus.DISCONNECTED
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

			for (const entity of transformEntities.values()) {
				if (world.has(entity)) entity.destroy()
			}
			transformEntities.clear()

			for (const entities of drawingEntities.values()) {
				for (const entity of entities) {
					if (world.has(entity)) entity.destroy()
				}
			}
			drawingEntities.clear()
		}
	})

	setContext<Context>(DRAW_SERVICE_KEY, {
		get connectionStatus() {
			return connectionStatus
		},
	})
}

export function useDrawService(): Context {
	return getContext<Context>(DRAW_SERVICE_KEY)
}
