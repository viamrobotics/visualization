import { FieldMask } from '@bufbuild/protobuf'
import { type Client, createClient } from '@connectrpc/connect'
import { createConnectTransport } from '@connectrpc/connect-web'
import { useThrelte } from '@threlte/core'
import { type Entity } from 'koota'
import { getContext, setContext } from 'svelte'
import { UuidTool } from 'uuid-tool'

import type { Drawing } from '$lib/buf/draw/v1/drawing_pb'
import type { Relationship } from '$lib/buf/draw/v1/metadata_pb'

import { DrawService } from '$lib/buf/draw/v1/service_connect'
import {
	CreateRelationshipRequest,
	DeleteRelationshipRequest,
	EntityChangeType,
	StreamEntityChangesResponse,
} from '$lib/buf/draw/v1/service_pb'
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

import { useCameraControls } from './useControls.svelte'
import { useDrawConnectionConfig } from './useDrawConnectionConfig.svelte'
import { useRelationships } from './useRelationships.svelte'

const DRAW_SERVICE_KEY = Symbol('draw-service-context')

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

	const processDrawingEvent = (drawing: Drawing, changeType: EntityChangeType, uuid: string) => {
		if (changeType === EntityChangeType.ADDED) {
			if (!drawingEntities.has(uuid)) {
				const spawned = drawDrawing(world, drawing, traits.DrawServiceAPI)
				relationships.apply(spawned.entity, spawned.relationships)
				drawingEntities.set(uuid, spawned.entity)
				relationships.flush(uuid)
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

		void streamEntityChanges(client, controller.signal)
		void streamSceneChanges(client, controller.signal)

		return () => {
			controller.abort()
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
