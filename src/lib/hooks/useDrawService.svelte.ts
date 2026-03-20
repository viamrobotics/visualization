import { createClient } from '@connectrpc/connect'
import { createConnectTransport } from '@connectrpc/connect-web'
import { useThrelte } from '@threlte/core'
import { type Entity } from 'koota'
import { getContext, setContext } from 'svelte'
import { UuidTool } from 'uuid-tool'

import { DrawService } from '$lib/buf/draw/v1/service_connect'
import { EntityChangeType, type StreamEntityChangesResponse } from '$lib/buf/draw/v1/service_pb'
import { traits, useWorld } from '$lib/ecs'
import {
	spawnDrawing,
	spawnTransform,
	updateDrawingEntity,
	updateTransformEntity,
} from '$lib/ecs/spawn'

import { useCameraControls } from './useControls.svelte'
import { useDrawConnectionConfig } from './useDrawConnectionConfig.svelte'

const DRAW_SERVICE_KEY = Symbol('draw-service-context')

type ConnectionStatus = 'connected' | 'disconnected' | 'connecting'

interface Context {
	connectionStatus: ConnectionStatus
}

interface StreamEvent {
	uuid: string
	changeType: EntityChangeType
	entity: StreamEntityChangesResponse['entity']
	updatedFields?: { paths: string[] }
}

export function provideDrawService(baseUrl?: () => string | undefined) {
	const { invalidate } = useThrelte()
	const world = useWorld()
	const cameraControls = useCameraControls()
	const drawConnectionConfig = useDrawConnectionConfig()

	let connectionStatus = $state<ConnectionStatus>('connecting')

	const url = $derived(
		baseUrl?.() ??
			(drawConnectionConfig.current?.backendIP
				? `http://${drawConnectionConfig.current.backendIP}:3030`
				: undefined)
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
			const transform = entity.value

			if (changeType === EntityChangeType.ADDED) {
				if (!transformEntities.has(uuid)) {
					const spawned = spawnTransform(world, transform, traits.DrawServiceAPI)
					transformEntities.set(uuid, spawned)
				}
			} else if (changeType === EntityChangeType.REMOVED) {
				destroyTransform(uuid)
			} else if (changeType === EntityChangeType.UPDATED) {
				const existing = transformEntities.get(uuid)
				if (existing) {
					updateTransformEntity(world, existing, transform)
				} else {
					const spawned = spawnTransform(world, transform, traits.DrawServiceAPI)
					transformEntities.set(uuid, spawned)
				}
			}
		} else if (entity.case === 'drawing') {
			const drawing = entity.value

			if (changeType === EntityChangeType.ADDED) {
				if (!drawingEntities.has(uuid)) {
					const spawned = spawnDrawing(world, drawing, traits.DrawServiceAPI)
					drawingEntities.set(uuid, spawned)
				}
			} else if (changeType === EntityChangeType.REMOVED) {
				destroyDrawing(uuid)
			} else if (changeType === EntityChangeType.UPDATED) {
				const existing = drawingEntities.get(uuid)
				if (existing) {
					const next = updateDrawingEntity(world, existing, drawing, traits.DrawServiceAPI)
					drawingEntities.set(uuid, next)
				} else {
					const spawned = spawnDrawing(world, drawing, traits.DrawServiceAPI)
					drawingEntities.set(uuid, spawned)
				}
			}
		}

		invalidate()
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
						// Entity added in this batch: apply the update's data but keep ADDED so it gets spawned
						existing.entity = event.entity
					} else if (existing.changeType === EntityChangeType.UPDATED) {
						existing.updatedFields ??= { paths: [] }
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

	$effect(() => {
		if (!url) {
			connectionStatus = 'disconnected'
			return
		}

		connectionStatus = 'connecting'
		let active = true
		const controller = new AbortController()
		const { signal } = controller

		const transport = createConnectTransport({ baseUrl: url })
		const client = createClient(DrawService, transport)

		;(async () => {
			try {
				for await (const response of client.streamEntityChanges({}, { signal })) {
					if (!active) break

					const { entity } = response
					if (!entity.case) continue

					const uuid = UuidTool.toString([...(entity.value.uuid ?? [])])
					pendingEvents.push({
						uuid,
						changeType: response.changeType,
						entity: response.entity,
						updatedFields: response.updatedFields
							? { paths: [...response.updatedFields.paths] }
							: undefined,
					})
					scheduleFlush()
				}
			} catch (error) {
				if (active) {
					console.error('Draw service entity stream error:', error)
					connectionStatus = 'disconnected'
				}
			}
		})()
		;(async () => {
			try {
				for await (const response of client.streamSceneChanges({}, { signal })) {
					if (!active) break

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
				if (active) {
					console.error('Draw service scene stream error:', error)
				}
			}
		})()

		connectionStatus = 'connected'

		return () => {
			active = false
			controller.abort()

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
