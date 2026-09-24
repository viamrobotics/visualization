<script lang="ts">
	import type { Entity } from 'koota'

	import { useThrelte } from '@threlte/core'
	import {
		Struct,
		type TransformChangeEvent,
		TransformChangeType,
		type TransformWithUUID,
		WorldStateStoreClient,
	} from '@viamrobotics/sdk'
	import { createResourceClient } from '@viamrobotics/svelte-sdk'

	import { createChunkLoader } from '$lib/chunking'
	import { drawTransform, updateMetadata } from '$lib/draw'
	import { hierarchy, traits, useWorld } from '$lib/ecs'
	import { isPointCloud } from '$lib/geometry'
	import { useRelationships } from '$lib/hooks/useRelationships.svelte'
	import { Pose } from '$lib/math'
	import { metadataFromStruct } from '$lib/metadata'
	import { useLogs } from '$lib/plugins/Logs/useLogs.svelte'

	import { decodeWorldStateChunk } from './decodeWorldStateChunk'

	type TransformEvent = TransformChangeEvent & {
		transform: TransformWithUUID
	}

	interface Props {
		partID: string
		name: string
	}

	let { partID, name }: Props = $props()

	const { invalidate } = useThrelte()
	const world = useWorld()
	const relationships = useRelationships()
	const logs = useLogs()

	const client = createResourceClient(
		WorldStateStoreClient,
		() => partID,
		() => name
	)

	const entities = new Map<string, Entity>()
	// UUIDs the stream has removed; guards against a stale initial snapshot or a
	// self-heal fetch re-creating an entity the server has already deleted.
	const removedUUIDs = new Set<string>()
	// UUIDs with an in-flight self-heal `getTransform`, to dedupe concurrent fetches.
	const pendingSpawns = new Set<string>()

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
		if (entities.has(transform.uuidString) || removedUUIDs.has(transform.uuidString)) {
			return
		}

		const spawned = drawTransform(world, transform, traits.WorldStateStoreAPI, { removable: false })
		entities.set(transform.uuidString, spawned.entity)
		relationships.apply(spawned.entity, spawned.relationships)

		const parsedMetadata = metadataFromStruct(transform.metadata?.fields)
		chunkLoader.start(transform.uuidString, spawned.entity, parsedMetadata)
		relationships.flush(transform.uuidString)

		if (isPointCloud(transform.physicalObject?.geometryType)) invalidate()
	}

	const destroyEntity = (uuid: string) => {
		removedUUIDs.add(uuid)

		const entity = entities.get(uuid)

		if (!entity) return

		if (world.has(entity)) {
			entity.destroy()
		}
		entities.delete(uuid)
	}

	// Spawn an entity whose UPDATE delta arrived before the initial snapshot
	// created it. The delta carries only changed fields, so fetch the full
	// transform; skip if it was removed or already spawned meanwhile.
	const spawnFromServer = async (uuid: string) => {
		if (entities.has(uuid) || removedUUIDs.has(uuid) || pendingSpawns.has(uuid)) return

		pendingSpawns.add(uuid)
		try {
			const transform = await client.current?.getTransform(uuid)
			if (transform && !removedUUIDs.has(uuid)) {
				spawnEntity(transform)
				invalidate()
			}
		} catch (error) {
			logs.add(`World state store: could not fetch transform ${uuid}`, 'error', {
				folder: 'world-state-store',
			})
			console.error('World state self-heal failed for', uuid, error)
		} finally {
			pendingSpawns.delete(uuid)
		}
	}

	// FieldMask paths are proto field names; spec-compliant backends emit
	// snake_case (`pose_in_observer_frame`) while some emit camelCase. Normalize
	// to camelCase so matching against the message's accessors is casing-agnostic.
	const snakeToCamel = (path: string): string =>
		path.replaceAll(/_([a-z])/g, (_, char: string) => char.toUpperCase())

	const updateEntity = (transform: TransformWithUUID, changes: (string | number)[]) => {
		const entity = entities.get(transform.uuidString)

		if (!entity) {
			void spawnFromServer(transform.uuidString)
			return
		}

		let metadataDirty = false

		for (const rawPath of changes) {
			if (typeof rawPath !== 'string') continue

			const path = snakeToCamel(rawPath)

			if (path.startsWith('poseInObserverFrame')) {
				const matrix = entity.get(traits.Matrix)
				if (matrix) {
					new Pose().copy(transform.poseInObserverFrame?.pose).toMatrix4(matrix)
					entity.changed(traits.Matrix)
				} else {
					entity.add(
						traits.Matrix(new Pose().copy(transform.poseInObserverFrame?.pose).toMatrix4())
					)
				}
				hierarchy.setParent(entity, transform.poseInObserverFrame?.referenceFrame)
			} else if (path.startsWith('physicalObject') && transform.physicalObject) {
				traits.updateGeometryTrait(entity, transform.physicalObject)
			} else if (path.startsWith('metadata')) {
				metadataDirty = true
			}
		}

		if (metadataDirty) {
			const parsedMetadata = metadataFromStruct(transform.metadata?.fields)
			updateMetadata(entity, parsedMetadata, {
				pointCloud: isPointCloud(transform.physicalObject?.geometryType),
			})
			relationships.apply(entity, parsedMetadata.relationships)
		}
	}

	let seeded = false
	let flushScheduled = false
	let rafId = 0
	let pendingEvents: TransformEvent[] = []

	/**
	 * Draws what the store already holds, once, so the scene is populated before
	 * the stream starts reporting changes.
	 *
	 * Direct calls rather than queries. Nothing reads this result again, so the
	 * cache buys nothing, and building one query per uuid meant rebuilding every
	 * observer each time the uuid list changed identity.
	 */
	const seedEntities = async (signal: AbortSignal) => {
		const activeClient = client.current
		if (!activeClient || seeded) return

		try {
			const uuids = await activeClient.listUUIDs(undefined, { signal })
			if (signal.aborted) return

			// Settled, not all: one unreadable transform drops itself rather than the
			// whole snapshot, which is what a query per uuid gave us.
			const transforms = await Promise.allSettled(
				uuids.map((uuid) => activeClient.getTransform(uuid, undefined, { signal }))
			)
			if (signal.aborted) return

			for (const transform of transforms) {
				if (transform.status === 'fulfilled') spawnEntity(transform.value)
			}

			// Set last, so a throw above leaves the snapshot undrawn and the next
			// connection tries again instead of skipping the seed forever.
			seeded = true

			const failed = transforms.filter((transform) => transform.status === 'rejected').length
			if (failed > 0) {
				logs.add(`World state store: ${failed} of ${uuids.length} transforms failed`, 'error', {
					folder: 'world-state-store',
				})
			}

			invalidate()
		} catch (error) {
			if (signal.aborted) return

			logs.add('World state store: could not load the current transforms', 'error', {
				folder: 'world-state-store',
			})
			console.error('World state seed failed:', error)
		}
	}

	const applyEvents = (events: TransformEvent[]) => {
		for (const event of events) {
			if (event.changeType === TransformChangeType.ADDED) {
				removedUUIDs.delete(event.transform.uuidString)
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

		rafId = requestAnimationFrame(() => {
			rafId = 0
			flushScheduled = false
			const toApply = pendingEvents
			pendingEvents = []
			applyEvents(toApply)
		})
	}

	/**
	 * Consumes the `streamTransformChanges` server stream directly.
	 * Transform changes are write-once into the ECS world, so we drain
	 * each event into `pendingEvents` (cleared every flush) and never
	 * retain history. Mirrors `useDrawService`'s stream consumption.
	 */
	const consumeChanges = async (signal: AbortSignal) => {
		const activeClient = client.current
		if (!activeClient) return

		try {
			for await (const event of activeClient.streamTransformChanges(undefined, { signal })) {
				if (signal.aborted) break
				if (!event.transform) continue

				pendingEvents.push(event as TransformEvent)
				scheduleFlush()
			}
		} catch (error) {
			if (!signal.aborted) {
				logs.add('World state store: transform stream failed', 'error', {
					folder: 'world-state-store',
				})
				console.error('World state transform stream error:', error)
			}
		}
	}

	$effect(() => {
		if (!client.current) return

		const controller = new AbortController()

		// The entities survived the disconnect, so any pull that ran out of client
		// mid-stream still owes its point cloud the rest of its chunks.
		chunkLoader.resume()
		void seedEntities(controller.signal)
		void consumeChanges(controller.signal)

		return () => {
			controller.abort()
		}
	})

	$effect(() => {
		return () => {
			if (rafId) cancelAnimationFrame(rafId)
			pendingEvents = []
			chunkLoader.dispose()
			for (const [, entity] of entities) {
				if (world.has(entity)) {
					entity.destroy()
				}
			}
			entities.clear()
		}
	})
</script>
