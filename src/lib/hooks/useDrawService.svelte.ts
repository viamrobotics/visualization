import { createClient } from '@connectrpc/connect'
import { createConnectTransport } from '@connectrpc/connect-web'
import { DrawService } from '$lib/draw/v1/service_connect'
import { ChangeType } from '$lib/draw/v1/service_pb'
import { getContext, setContext } from 'svelte'
import {
	traits,
	useWorld,
	spawnTransformEntity,
	spawnDrawingEntities,
	updateTransformEntity,
	updateDrawingEntities,
} from '$lib/ecs'
import type { Entity } from 'koota'
import { useThrelte } from '@threlte/core'
import { UuidTool } from 'uuid-tool'

const DRAW_SERVICE_CONTEXT = Symbol('draw-service-context')

type DrawServiceContext = {
	connectionStatus: 'connected' | 'disconnected' | 'connecting'
}

export function provideDrawService(baseUrl = 'http://localhost:3030') {
	const { invalidate } = useThrelte()
	const world = useWorld()

	let connectionStatus = $state<'connected' | 'disconnected' | 'connecting'>('connecting')

	const transport = createConnectTransport({ baseUrl })
	const client = createClient(DrawService, transport)

	const transformEntities = new Map<string, Entity>()
	const drawingEntities = new Map<string, Entity[]>()

	const destroyTransformEntity = (uuid: string) => {
		const entity = transformEntities.get(uuid)
		if (!entity) return

		if (world.has(entity)) entity.destroy()
		transformEntities.delete(uuid)
	}

	const destroyDrawingEntities = (uuid: string) => {
		const entities = drawingEntities.get(uuid)
		if (!entities) return

		for (const entity of entities) {
			if (world.has(entity)) entity.destroy()
		}
		drawingEntities.delete(uuid)
	}

	$effect(() => {
		connectionStatus = 'connecting'
		let active = true

		;(async () => {
			try {
				for await (const response of client.streamTransformChanges({})) {
					if (!active) break

					const { changeType, transform } = response
					if (!transform) continue

					const uuidStr = UuidTool.toString([...transform.uuid])
					if (changeType === ChangeType.ADDED) {
						if (!transformEntities.has(uuidStr)) {
							const entity = spawnTransformEntity(world, transform, traits.DrawServiceAPI, {
								invalidate,
							})

							transformEntities.set(uuidStr, entity)
						}
					} else if (changeType === ChangeType.REMOVED) {
						destroyTransformEntity(uuidStr)
					} else if (changeType === ChangeType.UPDATED) {
						const entity = transformEntities.get(uuidStr)
						if (entity) {
							updateTransformEntity(world, entity, transform, { invalidate })
						}
					}
				}
			} catch (err) {
				if (active) {
					console.error('Transform stream error:', err)
					connectionStatus = 'disconnected'
				}
			}
		})()

		// Stream drawing changes
		;(async () => {
			try {
				for await (const response of client.streamDrawingChanges({})) {
					if (!active) break

					const { changeType, drawing } = response
					if (!drawing) continue

					const uuidStr = UuidTool.toString([...drawing.uuid])
					if (changeType === ChangeType.ADDED) {
						if (!drawingEntities.has(uuidStr)) {
							const entities = spawnDrawingEntities(world, drawing, traits.DrawServiceAPI)
							drawingEntities.set(uuidStr, entities)
						}
					} else if (changeType === ChangeType.REMOVED) {
						destroyDrawingEntities(uuidStr)
					} else if (changeType === ChangeType.UPDATED) {
						const oldEntities = drawingEntities.get(uuidStr) ?? []
						const newEntities = updateDrawingEntities(
							world,
							oldEntities,
							drawing,
							traits.DrawServiceAPI
						)
						drawingEntities.set(uuidStr, newEntities)
					}
				}
			} catch (err) {
				if (active) {
					console.error('Drawing stream error:', err)
					connectionStatus = 'disconnected'
				}
			}
		})()

		// Stream scene changes
		;(async () => {
			try {
				for await (const response of client.streamSceneChanges({})) {
					if (!active) break

					const { sceneMetadata } = response
					if (!sceneMetadata) continue

					// TODO: Apply scene metadata to settings
					// For now, just log it
					console.log('Scene metadata update:', sceneMetadata)
				}
			} catch (err) {
				if (active) {
					console.error('Scene stream error:', err)
				}
			}
		})()

		connectionStatus = 'connected'

		return () => {
			active = false
			for (const entity of transformEntities.values()) {
				entity.destroy()
			}

			transformEntities.clear()

			for (const entities of drawingEntities.values()) {
				for (const entity of entities) {
					entity.destroy()
				}
			}

			drawingEntities.clear()
		}
	})

	setContext<DrawServiceContext>(DRAW_SERVICE_CONTEXT, {
		get connectionStatus() {
			return connectionStatus
		},
	})
}

export function useDrawService() {
	return getContext<DrawServiceContext>(DRAW_SERVICE_CONTEXT)
}
