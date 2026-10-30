<script lang="ts">
	import type { Entity } from 'koota'

	import { useThrelte } from '@threlte/core/webgpu'
	import {
		Struct,
		type TransformChangeEvent,
		TransformChangeType,
		type TransformWithUUID,
		WorldStateStoreClient,
	} from '@viamrobotics/sdk'
	import { createResourceClient, useResourceGeneration } from '@viamrobotics/svelte-sdk'
	import { untrack } from 'svelte'

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

	// Changes when the store is rebuilt under the same name, which leaves `client.current` as it was.
	const generation = useResourceGeneration(
		() => partID,
		() => name
	)

	// The last generation the status reported. Empty until the first status arrives.
	let lastGeneration = ''
	// Set when the stream ended without being aborted, which only happens when its instance closed.
	let streamClosed = false
	// Counts confirmed rebuilds. The stream effect reads it, so a rebuild reopens the stream.
	let rebuilds = $state(0)
	// The `rebuilds` value the last snapshot ran against, to tell a rebuild from a reconnect.
	let syncedRebuilds = 0

	// Detects a rebuild as an event, which no derived can express: a change between two
	// reported generations. A status that drops out and returns to the same value is not one.
	$effect.pre(() => {
		const current = generation.current
		if (current === '') return

		// The first status names the instance already being read, unless that instance closed first.
		const isRebuild = lastGeneration === '' ? streamClosed : current !== lastGeneration
		lastGeneration = current

		if (isRebuild) untrack(() => rebuilds++)
	})

	/** Every field a snapshot transform carries, for re-applying it to an entity already drawn. */
	const SNAPSHOT_FIELDS = ['poseInObserverFrame', 'physicalObject', 'metadata']

	const entities = new Map<string, Entity>()
	// What each drawn entity's geometry is, by uuid. A rebuilt instance holding a different kind
	// under the same uuid is respawned, since an update cannot remove geometry.
	const geometryKinds = new Map<string, string | undefined>()
	// UUIDs the stream has removed; guards against an in-flight snapshot or a
	// self-heal fetch re-creating an entity the server has already deleted.
	const removedUUIDs = new Set<string>()
	// UUIDs with an in-flight self-heal `getTransform`, to dedupe concurrent fetches.
	const pendingSpawns = new Set<string>()
	// Bumped per snapshot, so a self-heal fetch begun before one cannot respawn what it settled.
	let syncEpoch = 0
	// True while a snapshot is in flight. Stream events wait, then replay on top of it in order.
	let isSyncing = false

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
		geometryKinds.set(transform.uuidString, transform.physicalObject?.geometryType?.case)
		relationships.apply(spawned.entity, spawned.relationships)

		const parsedMetadata = metadataFromStruct(transform.metadata?.fields)
		chunkLoader.start(transform.uuidString, spawned.entity, parsedMetadata)
		relationships.flush(transform.uuidString)

		if (isPointCloud(transform.physicalObject?.geometryType)) invalidate()
	}

	const destroyEntity = (uuid: string) => {
		removedUUIDs.add(uuid)
		chunkLoader.stop(uuid)
		geometryKinds.delete(uuid)

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
		const epoch = syncEpoch
		try {
			const transform = await client.current?.getTransform(uuid)
			if (transform && epoch === syncEpoch && !removedUUIDs.has(uuid)) {
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
				geometryKinds.set(transform.uuidString, transform.physicalObject.geometryType?.case)
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

	let flushScheduled = false
	let rafId = 0
	let pendingEvents: TransformEvent[] = []

	/**
	 * Draws one transform from a snapshot of a rebuilt store. An entity an update
	 * cannot bring in line is respawned. Anything else updates in place, so it keeps
	 * its identity and stays selected.
	 */
	const applySnapshotTransform = (transform: TransformWithUUID) => {
		const uuid = transform.uuidString
		const entity = entities.get(uuid)

		if (!entity) {
			spawnEntity(transform)
			return
		}

		// A drawn cloud holds chunks pulled from the old instance, and only a respawn
		// restarts the loader. An update never renames, and cannot remove geometry.
		const mustRespawn =
			isPointCloud(transform.physicalObject?.geometryType) ||
			geometryKinds.get(uuid) !== transform.physicalObject?.geometryType?.case ||
			entity.get(traits.Name) !== transform.referenceFrame

		if (!mustRespawn) {
			updateEntity(transform, SNAPSHOT_FIELDS)
			return
		}

		destroyEntity(uuid)
		removedUUIDs.delete(uuid)
		spawnEntity(transform)
	}

	/**
	 * Brings the scene in line with what the store holds now, each time a stream
	 * opens. The stream reports only changes made after it opens, so whatever the
	 * store gained or lost while none was open (a reconnect, a rebuild) shows up
	 * only in this snapshot. Stream events wait until it is drawn, then replay on
	 * top of it in order, so every field ends at its newest value.
	 *
	 * Direct calls rather than queries. Nothing reads this result again, so the
	 * cache buys nothing, and building one query per uuid meant rebuilding every
	 * observer each time the uuid list changed identity.
	 *
	 * @param isRebuild Whether the store was replaced since the last snapshot. A
	 *   reconnect reaches the same instance, so only the uuids it gained are fetched.
	 */
	const syncSnapshot = async (signal: AbortSignal, isRebuild: boolean) => {
		const activeClient = client.current
		if (!activeClient) return

		// The snapshot below is the truth, and the replayed stream events after it.
		const epoch = ++syncEpoch
		removedUUIDs.clear()
		isSyncing = true

		try {
			const uuids = await activeClient.listUUIDs(undefined, { signal })
			if (signal.aborted) return

			// Diffed against `uuids`, not the transforms that load, so an unreadable
			// transform keeps its entity instead of looking deleted.
			const snapshotUUIDs = new Set(uuids)
			for (const uuid of entities.keys()) {
				if (!snapshotUUIDs.has(uuid)) destroyEntity(uuid)
			}

			const toFetch = isRebuild ? uuids : uuids.filter((uuid) => !entities.has(uuid))

			// Settled, not all: one unreadable transform drops itself rather than the
			// whole snapshot, which is what a query per uuid gave us.
			const transforms = await Promise.allSettled(
				toFetch.map((uuid) => activeClient.getTransform(uuid, undefined, { signal }))
			)
			if (signal.aborted) return

			for (const transform of transforms) {
				if (transform.status === 'fulfilled') applySnapshotTransform(transform.value)
			}

			const failed = transforms.filter((transform) => transform.status === 'rejected').length
			if (failed > 0) {
				logs.add(`World state store: ${failed} of ${toFetch.length} transforms failed`, 'error', {
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
		} finally {
			// An aborted snapshot settles after the next one started, which owns the flag by then.
			if (epoch === syncEpoch) {
				isSyncing = false
				if (pendingEvents.length > 0) scheduleFlush()
			}
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
		if (flushScheduled || isSyncing) return
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

			if (!signal.aborted) streamClosed = true
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
		if (!client.current || !generation.canQuery) return

		// A rebuilt store closes the old stream, and this reopens one against the new instance.
		const isRebuild = rebuilds !== syncedRebuilds
		syncedRebuilds = rebuilds
		streamClosed = false

		const controller = new AbortController()

		// The entities survived the disconnect, so any pull that ran out of client
		// mid-stream still owes its point cloud the rest of its chunks. A rebuild
		// respawns every cloud instead, since the new instance's chunks may differ.
		if (!isRebuild) chunkLoader.resume()
		void syncSnapshot(controller.signal, isRebuild)
		void consumeChanges(controller.signal)

		return () => {
			controller.abort()

			// What the old stream buffered describes the instance being left. The next snapshot covers it.
			if (rafId) cancelAnimationFrame(rafId)
			rafId = 0
			flushScheduled = false
			pendingEvents = []
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
