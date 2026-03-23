import { FieldMask } from '@bufbuild/protobuf'
import { type Client, createClient } from '@connectrpc/connect'
import { createConnectTransport } from '@connectrpc/connect-web'
import { useThrelte } from '@threlte/core'
import { type Entity } from 'koota'
import { getContext, setContext, untrack } from 'svelte'
import { UuidTool } from 'uuid-tool'

import type { Drawing } from '$lib/buf/draw/v1/drawing_pb'

import { DrawService } from '$lib/buf/draw/v1/service_connect'
import { EntityChangeType, StreamEntityChangesResponse } from '$lib/buf/draw/v1/service_pb'
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

const TRANSITIONS: Record<ConnectionStatusType, ConnectionStatusType[]> = {
	disconnected: ['connecting'],
	connecting: ['connected', 'disconnected'],
	connected: ['disconnected'],
}

const createConnectionMachine = (initial: ConnectionStatusType = ConnectionStatus.DISCONNECTED) => {
	let current = $state<ConnectionStatusType>(initial)
	let controller = new AbortController()

	return {
		get status() {
			return current
		},
		get signal() {
			return controller.signal
		},
		can(to: ConnectionStatusType) {
			return TRANSITIONS[current]?.includes(to) ?? false
		},
		send(to: ConnectionStatusType) {
			if (!this.can(to)) {
				console.warn(`Invalid draw service connection transition: ${current} -> ${to}`)
				return false
			}

			if (to === ConnectionStatus.CONNECTING) {
				controller = new AbortController()
			} else if (to === ConnectionStatus.DISCONNECTED) {
				controller.abort()
			}

			current = to
			return true
		},
	}
}

export function provideDrawService() {
	const { invalidate } = useThrelte()
	const world = useWorld()
	const cameraControls = useCameraControls()
	const drawConnectionConfig = useDrawConnectionConfig()
	const connection = createConnectionMachine()

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

	const processDrawingEvent = (drawing: Drawing, changeType: EntityChangeType, uuid: string) => {
		if (changeType === EntityChangeType.ADDED) {
			if (!drawingEntities.has(uuid)) {
				const spawned = drawDrawing(world, drawing, traits.DrawServiceAPI)
				drawingEntities.set(uuid, spawned)
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
				connection.send(ConnectionStatus.CONNECTED)

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
				connection.send(ConnectionStatus.DISCONNECTED)
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
			untrack(() => connection.send(ConnectionStatus.DISCONNECTED))
			return
		}

		untrack(() => connection.send(ConnectionStatus.CONNECTING))

		const transport = createConnectTransport({ baseUrl: url })
		const client = createClient(DrawService, transport)

		void streamEntityChanges(client, connection.signal)
		void streamSceneChanges(client, connection.signal)

		return () => {
			connection.send(ConnectionStatus.DISCONNECTED)

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
			return connection.status
		},
	})
}

export function useDrawService(): Context {
	return getContext<Context>(DRAW_SERVICE_KEY)
}
