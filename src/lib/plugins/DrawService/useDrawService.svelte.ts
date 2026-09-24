import { type Client, ConnectError, createClient } from '@connectrpc/connect'
import { createConnectTransport } from '@connectrpc/connect-web'
import { useThrelte } from '@threlte/core'
import { type Entity } from 'koota'
import { getContext, setContext } from 'svelte'
import { UuidTool } from 'uuid-tool'

import type { Drawing } from '$lib/buf/draw/v1/drawing_pb'

import { writeBufferGeometryRange } from '$lib/attribute'
import { DrawService } from '$lib/buf/draw/v1/service_connect'
import { EntityChangeType, EntityScope } from '$lib/buf/draw/v1/service_pb'
import { asFloat32Array, inMeters, STRIDE } from '$lib/buffer'
import {
	drawDrawing,
	drawTransform,
	type Transform,
	updateDrawing,
	updateModel,
	updateTransform,
} from '$lib/draw'
import { hierarchy, traits, useWorld } from '$lib/ecs'
import { useCameraControls } from '$lib/hooks/useControls.svelte'
import { useLogs } from '$lib/plugins/Logs/useLogs.svelte'

import {
	clearsDrawings,
	clearsTransforms,
	emptyPendingChanges,
	isEmpty,
	mergeClear,
	mergeEvent,
	type PendingChanges,
	type StreamEvent,
	survivingUUIDs,
} from './coalesceEvents'
import { runWithReconnect } from './reconnect'
import { createServerRelationships } from './serverRelationships'
import {
	DEFAULT_DRAW_SERVICE_PORT,
	useDrawConnectionConfig,
} from './useDrawConnectionConfig.svelte'

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

export function provideDrawService() {
	const { invalidate } = useThrelte()
	const world = useWorld()
	const cameraControls = useCameraControls()
	const drawConnectionConfig = useDrawConnectionConfig()
	const serverRelationships = createServerRelationships()

	const logs = useLogs()

	// Everything this service reports lands in the world tree's Drawn folder, which
	// is the only row standing for the draw server's connection.
	const log = (message: string, level?: 'info' | 'warn' | 'error') => {
		logs.add(message, level, { folder: 'drawn' })
	}

	let connectionStatus = $state<ConnectionStatusType>(ConnectionStatus.DISCONNECTED)
	// The stream retries on a backoff, so a server that is simply down would otherwise emit one
	// "unreachable" line per attempt forever. Report it once per outage instead.
	let reportedUnreachable = false

	const url = $derived.by(() => {
		const config = drawConnectionConfig.current
		if (!config?.backendIP) return undefined

		return `http://${config.backendIP}:${config.port ?? DEFAULT_DRAW_SERVICE_PORT}`
	})

	const transformEntities = new Map<string, Entity>()
	const drawingEntities = new Map<string, Entity>()

	let pendingChanges: PendingChanges = emptyPendingChanges()
	let flushHandle: number | undefined
	let activeClient: Client<typeof DrawService> | undefined
	let activeSignal: AbortSignal | undefined
	const activeChunkPulls = new Set<string>()

	const destroyTransform = (uuidStr: string) => {
		const entity = transformEntities.get(uuidStr)
		if (!entity) return
		hierarchy.destroyEntityTree(world, entity)
		transformEntities.delete(uuidStr)
	}

	const destroyDrawing = (uuidStr: string) => {
		const entity = drawingEntities.get(uuidStr)
		if (!entity) return
		hierarchy.destroyEntityTree(world, entity)
		drawingEntities.delete(uuidStr)
	}

	const processEvent = (event: StreamEvent) => {
		const { changeType, entity, uuid } = event

		if (entity.case === 'transform') {
			processTransformEvent(entity.value, changeType, uuid)
		} else if (entity.case === 'drawing') {
			processDrawingEvent(entity.value, changeType, uuid)
		}
	}

	const spawnTransform = (transform: Transform, uuid: string) => {
		const spawned = drawTransform(world, transform, traits.DrawAPI)
		serverRelationships.apply(spawned.entity, uuid, spawned.relationships)
		transformEntities.set(uuid, spawned.entity)
	}

	/**
	 * ADDED and UPDATED are both upserts.
	 *
	 * Every broadcast message carries the entity's full state, so an ADDED for a UUID we already
	 * hold is newer state rather than a duplicate — treating it as a no-op would drop a redraw.
	 * Updating in place also avoids destroying and respawning the scene object, which costs a
	 * frame at the wrong world transform while the entity's parent link re-resolves.
	 */
	const processTransformEvent = (
		transform: Transform,
		changeType: EntityChangeType,
		uuid: string
	) => {
		if (changeType === EntityChangeType.REMOVED) {
			serverRelationships.forget(uuid)
			destroyTransform(uuid)
			return
		}

		// A UUID that switches kind has to give up its old entity first.
		if (drawingEntities.has(uuid)) {
			serverRelationships.forget(uuid)
			destroyDrawing(uuid)
		}

		const existing = transformEntities.get(uuid)
		if (existing && world.has(existing)) {
			const updated = updateTransform(existing, transform)
			serverRelationships.apply(updated.entity, uuid, updated.relationships)
			return
		}

		spawnTransform(transform, uuid)
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
		// The progress trait is added here rather than by the caller so it cannot outlive the pull.
		// An early return below would otherwise leave a caller-added trait with nothing to remove
		// it, and the entity would show a loading bar forever.
		if (activeChunkPulls.has(uuid)) return
		activeChunkPulls.add(uuid)
		entity.add(traits.ChunkProgress({ loaded: firstChunkEnd, total: totalElements }))

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

	const spawnDrawing = (drawing: Drawing, uuid: string) => {
		const spawned = drawDrawing(world, drawing, traits.DrawAPI)
		serverRelationships.apply(spawned.entity, uuid, spawned.relationships)
		drawingEntities.set(uuid, spawned.entity)

		if (isChunkedDrawing(drawing) && activeClient && activeSignal) {
			const chunk = getChunkInfo(drawing)
			if (chunk) {
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

	/** ADDED and UPDATED are both upserts. See `processTransformEvent`. */
	const processDrawingEvent = (drawing: Drawing, changeType: EntityChangeType, uuid: string) => {
		if (changeType === EntityChangeType.REMOVED) {
			serverRelationships.forget(uuid)
			destroyDrawing(uuid)
			return
		}

		if (transformEntities.has(uuid)) {
			serverRelationships.forget(uuid)
			destroyTransform(uuid)
		}

		const existing = drawingEntities.get(uuid)
		if (existing && world.has(existing)) {
			// A chunked drawing restarts its chunk pull from scratch, so the old entity (and the
			// half-filled BufferGeometry the previous pull was writing into) has to go.
			if (isChunkedDrawing(drawing)) {
				destroyDrawing(uuid)
				spawnDrawing(drawing, uuid)
				return
			}

			const isModel = drawing.physicalObject?.geometryType?.case === 'model'
			const result = isModel
				? updateModel(world, existing, drawing, traits.DrawAPI)
				: updateDrawing(world, existing, drawing)
			serverRelationships.apply(result.entity, uuid, result.relationships)
			drawingEntities.set(uuid, result.entity)
			return
		}

		spawnDrawing(drawing, uuid)
	}

	/**
	 * Apply a pending bulk removal by reconciling rather than tearing down.
	 *
	 * Entities the same flush is about to re-create are left alone; only the ones that did not
	 * come back are destroyed. A redraw loop that clears and repopulates a scene therefore
	 * updates in place instead of churning every scene object.
	 */
	const applyClear = (pending: PendingChanges) => {
		const scope = pending.clearedScope
		if (scope === undefined) return

		const surviving = survivingUUIDs(pending)

		if (clearsTransforms(scope)) {
			for (const uuid of transformEntities.keys()) {
				if (surviving.has(uuid)) continue
				serverRelationships.forget(uuid)
				destroyTransform(uuid)
			}
		}
		if (clearsDrawings(scope)) {
			for (const uuid of drawingEntities.keys()) {
				if (surviving.has(uuid)) continue
				serverRelationships.forget(uuid)
				destroyDrawing(uuid)
			}
		}
	}

	const applyChanges = (pending: PendingChanges) => {
		if (isEmpty(pending)) return

		applyClear(pending)
		for (const event of pending.events.values()) {
			processEvent(event)
		}

		invalidate()
	}

	const scheduleFlush = () => {
		if (flushHandle !== undefined) return

		flushHandle = requestAnimationFrame(() => {
			flushHandle = undefined
			const toApply = pendingChanges
			pendingChanges = emptyPendingChanges()
			applyChanges(toApply)
		})
	}

	/**
	 * Drop every entity this consumer owns and discard buffered work.
	 *
	 * Runs before each connection attempt so the server's on-connect replay lands on an empty
	 * world. Cancelling the scheduled flush matters as much as clearing the maps: a flush queued
	 * before a reset would otherwise fire afterwards and respawn entities into the cleared maps,
	 * leaving them unreachable and impossible to remove.
	 */
	const clearLocalState = () => {
		if (flushHandle !== undefined) {
			cancelAnimationFrame(flushHandle)
			flushHandle = undefined
		}
		pendingChanges = emptyPendingChanges()
		activeChunkPulls.clear()

		for (const entity of transformEntities.values()) {
			hierarchy.destroyEntityTree(world, entity)
		}
		transformEntities.clear()

		for (const entity of drawingEntities.values()) {
			hierarchy.destroyEntityTree(world, entity)
		}
		drawingEntities.clear()
		serverRelationships.reset()

		invalidate()
	}

	/** Every streamed message reports connectivity, so only log the edge into `connected`. */
	const markConnected = () => {
		if (connectionStatus === ConnectionStatus.CONNECTED) return

		connectionStatus = ConnectionStatus.CONNECTED
		reportedUnreachable = false
		log(`Connected to draw server at ${url}`)
	}

	const streamEntityChanges = async (
		client: Client<typeof DrawService>,
		signal: AbortSignal,
		onData: () => void
	) => {
		for await (const response of client.streamEntityChanges({}, { signal })) {
			markConnected()
			onData()

			if (response.clearedScope !== EntityScope.UNSPECIFIED) {
				mergeClear(pendingChanges, response.clearedScope)
				scheduleFlush()
				continue
			}

			const { entity } = response
			if (!entity.case) continue

			const uuid = UuidTool.toString([...(entity.value.uuid ?? [])])
			mergeEvent(pendingChanges, {
				uuid,
				changeType: response.changeType,
				entity,
				updatedFields: response.updatedFields,
			})
			scheduleFlush()
		}
	}

	const streamSceneChanges = async (
		client: Client<typeof DrawService>,
		signal: AbortSignal,
		onData: () => void
	) => {
		for await (const response of client.streamSceneChanges({}, { signal })) {
			onData()
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

		void runWithReconnect({
			signal: controller.signal,
			onBeforeAttempt: () => {
				connectionStatus = ConnectionStatus.CONNECTING
				clearLocalState()
			},
			run: (signal, onData) => {
				// Chunk pulls are cancelled by this attempt's signal, so a reconnect cannot leave
				// the previous attempt writing into entities the resync destroyed.
				activeClient = client
				activeSignal = signal
				return streamEntityChanges(client, signal, onData)
			},
			onStatus: () => {
				const wasConnected = connectionStatus === ConnectionStatus.CONNECTED
				connectionStatus = ConnectionStatus.DISCONNECTED

				if (wasConnected) {
					log('Disconnected from draw server, reconnecting...', 'warn')
				} else if (!reportedUnreachable) {
					reportedUnreachable = true
					log(`Could not reach draw server at ${url}, retrying...`, 'warn')
				}
			},
			onError: (error) => {
				log(`Draw server error: ${ConnectError.from(error).message}`, 'error')
			},
		})

		void runWithReconnect({
			signal: controller.signal,
			onBeforeAttempt: () => {},
			run: (signal, onData) => streamSceneChanges(client, signal, onData),
		})

		return () => {
			controller.abort()
			activeClient = undefined
			activeSignal = undefined
			connectionStatus = ConnectionStatus.DISCONNECTED
			clearLocalState()
		}
	})

	$effect(() => () => serverRelationships.dispose())

	return setContext<Context>(DRAW_SERVICE_KEY, {
		get connectionStatus() {
			return connectionStatus
		},
	})
}

export function useDrawService(): Context {
	return getContext<Context>(DRAW_SERVICE_KEY)
}
