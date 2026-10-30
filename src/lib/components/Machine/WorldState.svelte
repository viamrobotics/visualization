<script lang="ts">
	import type { Entity } from 'koota'

	import { Code, ConnectError } from '@connectrpc/connect'
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
	import { Matrix4 } from 'three'

	import { createChunkLoader } from '$lib/chunking'
	import { drawTransform, updateMetadata } from '$lib/draw'
	import { hierarchy, traits, useWorld } from '$lib/ecs'
	import { ChildOf } from '$lib/ecs/relations'
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
	// Counts rebuilds, confirmed or possible. The stream effect reads it, so each one reopens the stream.
	let rebuilds = $state(0)
	// The `rebuilds` value the last snapshot ran against, to tell a rebuild from a reconnect.
	let syncedRebuilds = 0
	// Streams that ended in a row without delivering an event or staying open long, which sets the
	// next reopen's delay.
	let reopenAttempts = 0

	// Detects a rebuild as an event, which no derived can express: a change between two
	// reported generations. The first status names the instance already being read, and a
	// status that drops out and returns to the same value is not a rebuild either.
	$effect.pre(() => {
		const current = generation.current
		if (current === '') return

		const isRebuild = lastGeneration !== '' && current !== lastGeneration
		lastGeneration = current

		if (isRebuild) untrack(() => rebuilds++)
	})

	/** How long each snapshot request may take. Stream events wait on the snapshot, so one hung request would freeze the scene. */
	const SNAPSHOT_TIMEOUT_MS = 10_000
	/** How long a stream has to stay open to count as healthy, which resets the reopen backoff. */
	const STREAM_HEALTHY_MS = 30_000
	/**
	 * The first reopen's delay after a stream ends. Longer than svelte-sdk's 1s status poll,
	 * so a real rebuild's generation change usually reopens the stream first.
	 */
	const REOPEN_BASE_DELAY_MS = 2000
	/** The longest a reopen waits, for a server or proxy that keeps ending streams. */
	const REOPEN_MAX_DELAY_MS = 30_000

	const entities = new Map<string, Entity>()
	// The metadata a snapshot last applied to each drawn uuid, serialized, so a snapshot repeating
	// it changes nothing. Only snapshots fill it: a stream update clears its entry instead, since
	// serializing on the hot path is too costly for metadata carrying per-point colors.
	const metadataFingerprints = new Map<string, string>()
	// Reused for comparing a snapshot pose against the drawn one.
	const nextMatrix = new Matrix4()
	// The geometry kind the store sent for each drawn uuid. The traits cannot say: a cloud reads
	// as a bare frame until its worker parse lands. A changed kind means a respawn.
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
				}),
				{ signal }
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
		metadataFingerprints.delete(uuid)

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
			// A snapshot since then cleared the set, and the uuid may belong to a newer fetch now.
			if (epoch === syncEpoch) pendingSpawns.delete(uuid)
		}
	}

	// FieldMask paths are proto field names; spec-compliant backends emit
	// snake_case (`pose_in_observer_frame`) while some emit camelCase. Normalize
	// to camelCase so matching against the message's accessors is casing-agnostic.
	const snakeToCamel = (path: string): string =>
		path.replaceAll(/_([a-z])/g, (_, char: string) => char.toUpperCase())

	const metadataFingerprint = (transform: TransformWithUUID) =>
		JSON.stringify(transform.metadata ?? null)

	/** Moves an entity to a transform's pose, marking it changed only if the pose differs. */
	const applyPose = (entity: Entity, transform: TransformWithUUID) => {
		new Pose().copy(transform.poseInObserverFrame?.pose).toMatrix4(nextMatrix)
		const matrix = entity.get(traits.Matrix)
		if (!matrix) {
			entity.add(traits.Matrix(nextMatrix.clone()))
		} else if (!matrix.equals(nextMatrix)) {
			matrix.copy(nextMatrix)
			entity.changed(traits.Matrix)
		}
		hierarchy.setParent(entity, transform.poseInObserverFrame?.referenceFrame)
	}

	/** Applies the fields a stream update names in `changes`. */
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
				applyPose(entity, transform)
			} else if (path.startsWith('physicalObject') && transform.physicalObject) {
				traits.updateGeometryTrait(entity, transform.physicalObject)
				geometryKinds.set(transform.uuidString, transform.physicalObject.geometryType?.case)
			} else if (path.startsWith('metadata')) {
				metadataDirty = true
			}
		}

		if (metadataDirty) {
			metadataFingerprints.delete(transform.uuidString)
			const parsedMetadata = metadataFromStruct(transform.metadata?.fields)
			updateMetadata(entity, parsedMetadata, {
				pointCloud: isPointCloud(transform.physicalObject?.geometryType),
			})
			relationships.apply(entity, parsedMetadata.relationships)
		}
	}

	/**
	 * Brings a drawn entity in line with a snapshot transform, touching only what
	 * differs, so a snapshot repeating the scene marks nothing changed. The geometry
	 * kind and name already match, or `mustRespawn` would have said so.
	 */
	const refreshEntity = (entity: Entity, transform: TransformWithUUID) => {
		applyPose(entity, transform)

		// Compares before writing: primitives by size, meshes by bytes.
		if (transform.physicalObject) traits.updateGeometryTrait(entity, transform.physicalObject)

		const parsedMetadata = metadataFromStruct(transform.metadata?.fields)
		const fingerprint = metadataFingerprint(transform)
		if (metadataFingerprints.get(transform.uuidString) !== fingerprint) {
			metadataFingerprints.set(transform.uuidString, fingerprint)
			updateMetadata(entity, parsedMetadata, {
				pointCloud: isPointCloud(transform.physicalObject?.geometryType),
			})
		}

		// Always, since a target respawned in the same snapshot needs its link restored.
		// Applying links that already exist changes nothing.
		relationships.apply(entity, parsedMetadata.relationships)
	}

	let flushScheduled = false
	let rafId = 0
	let pendingEvents: TransformEvent[] = []

	/**
	 * Whether a drawn entity has to be respawned to match a snapshot transform. A
	 * drawn cloud holds chunks pulled from an older read, and only a respawn restarts
	 * the loader. An update never renames, and cannot remove geometry.
	 */
	const mustRespawn = (entity: Entity, transform: TransformWithUUID) =>
		isPointCloud(transform.physicalObject?.geometryType) ||
		geometryKinds.get(transform.uuidString) !== transform.physicalObject?.geometryType?.case ||
		entity.get(traits.Name) !== transform.referenceFrame

	/**
	 * Draws a snapshot's transforms. An entity an update cannot bring in line is
	 * respawned, and anything else updates in place, so it keeps its identity and
	 * stays selected.
	 *
	 * Respawns are destroyed before anything spawns, and updates run last. A link to
	 * a respawned target then waits in the relationship registry and lands on the new
	 * entity, instead of being kept on the old one and dropped with it. A respawned
	 * entity's children are re-orphaned by its name, since the hierarchy does not
	 * reattach the children of a destroyed parent on its own.
	 */
	const applySnapshot = (transforms: TransformWithUUID[]) => {
		const spawns: TransformWithUUID[] = []
		const refreshes: Array<{ entity: Entity; transform: TransformWithUUID }> = []
		const orphanedChildren: Array<{ child: Entity; parentName: string | undefined }> = []

		for (const transform of transforms) {
			const entity = entities.get(transform.uuidString)

			if (entity && !mustRespawn(entity, transform)) {
				refreshes.push({ entity, transform })
				continue
			}

			if (entity) {
				const parentName = entity.get(traits.Name)
				for (const child of world.query(ChildOf(entity)))
					orphanedChildren.push({ child, parentName })

				destroyEntity(transform.uuidString)
				removedUUIDs.delete(transform.uuidString)
			}
			spawns.push(transform)
		}

		for (const transform of spawns) {
			spawnEntity(transform)
			metadataFingerprints.set(transform.uuidString, metadataFingerprint(transform))
		}

		for (const { child, parentName } of orphanedChildren) {
			if (child.isAlive()) hierarchy.setParent(child, parentName)
		}

		for (const { entity, transform } of refreshes) refreshEntity(entity, transform)
	}

	/** Which uuids a snapshot fetches in full. */
	const uuidsToFetch = (uuids: string[], isRebuild: boolean) => {
		if (isRebuild) return uuids

		// A reconnect reaches the same instance. Its drawn clouds are skipped: fetching one
		// downloads its first chunk again, and a pose change made while offline is the cost.
		return uuids.filter((uuid) => geometryKinds.get(uuid) !== 'pointcloud' || !entities.has(uuid))
	}

	/**
	 * Brings the scene in line with what the store holds now, each time a stream
	 * opens. The stream reports only changes made after it opens, so whatever the
	 * store gained or lost while none was open (a reconnect, a rebuild) shows up
	 * only in this snapshot. Stream events wait until it is drawn, then replay on
	 * top of it in order, so a later change wins. `updateMetadata` never clears a
	 * field the store dropped, such as colors, so that one can outlive its removal.
	 *
	 * The stream is opened first, but the server gives no sign that it has
	 * subscribed, so a change landing between the two can still be missed until
	 * the next snapshot.
	 *
	 * Direct calls rather than queries. Nothing reads this result again, so the
	 * cache buys nothing, and building one query per uuid meant rebuilding every
	 * observer each time the uuid list changed identity.
	 *
	 * @param isRebuild Whether the store was replaced since the last snapshot. See
	 *   `uuidsToFetch` for what a reconnect fetches instead.
	 */
	const syncSnapshot = async (streamSignal: AbortSignal, isRebuild: boolean) => {
		const activeClient = client.current
		if (!activeClient) return

		// The snapshot below is the truth, and the replayed stream events after it.
		const epoch = ++syncEpoch
		removedUUIDs.clear()
		// Fetches started before this snapshot are discarded on landing, so none of them is pending.
		pendingSpawns.clear()
		isSyncing = true

		// Up front, not after the snapshot loads: a snapshot that fails would leave old-instance
		// pulls writing the new instance's chunks into old buffers, or parked to resume at old offsets.
		if (isRebuild) {
			for (const [uuid, kind] of geometryKinds) {
				if (kind === 'pointcloud') chunkLoader.stop(uuid)
			}
		}

		// Per request, so a large store on a slow link is not cut off partway every time.
		const requestSignal = () =>
			AbortSignal.any([streamSignal, AbortSignal.timeout(SNAPSHOT_TIMEOUT_MS)])

		try {
			const uuids = await activeClient.listUUIDs(undefined, { signal: requestSignal() })
			if (streamSignal.aborted) return

			// Diffed against `uuids`, not the transforms that load, so an unreadable
			// transform keeps its entity instead of looking deleted.
			const snapshotUUIDs = new Set(uuids)
			for (const uuid of entities.keys()) {
				if (!snapshotUUIDs.has(uuid)) destroyEntity(uuid)
			}

			const toFetch = uuidsToFetch(uuids, isRebuild)

			// Settled, not all: one unreadable transform drops itself rather than the
			// whole snapshot, which is what a query per uuid gave us.
			const transforms = await Promise.allSettled(
				toFetch.map((uuid) =>
					activeClient.getTransform(uuid, undefined, { signal: requestSignal() })
				)
			)
			if (streamSignal.aborted) return

			applySnapshot(
				transforms.flatMap((transform) =>
					transform.status === 'fulfilled' ? [transform.value] : []
				)
			)

			const failed = transforms.filter((transform) => transform.status === 'rejected').length
			if (failed > 0) {
				logs.add(`World state store: ${failed} of ${toFetch.length} transforms failed`, 'error', {
					folder: 'world-state-store',
				})
			}

			invalidate()
		} catch (error) {
			if (streamSignal.aborted) return

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

		const openedAt = Date.now()
		let isUnsupported = false

		try {
			for await (const event of activeClient.streamTransformChanges(undefined, { signal })) {
				if (signal.aborted) break
				if (!event.transform) continue

				reopenAttempts = 0
				pendingEvents.push(event as TransformEvent)
				scheduleFlush()
			}
		} catch (error) {
			if (!signal.aborted) {
				isUnsupported = ConnectError.from(error).code === Code.Unimplemented
				const message = isUnsupported
					? 'World state store: this store does not stream changes, so the scene will not update live'
					: 'World state store: transform stream failed'
				logs.add(message, 'error', { folder: 'world-state-store' })
				console.error('World state transform stream error:', error)
			}
		}

		if (signal.aborted || isUnsupported) return

		if (Date.now() - openedAt >= STREAM_HEALTHY_MS) reopenAttempts = 0
		scheduleReopen(signal)
	}

	/**
	 * Reopens a stream that ended on its own, cleanly or not, as a rebuild. Its end
	 * cannot say whether the instance changed, and only the rebuild path is safe if it
	 * did: it respawns every cloud instead of resuming pulls at the old instance's offsets.
	 * A generation change or reconnect before the delay aborts `signal`, which cancels this.
	 */
	const scheduleReopen = (signal: AbortSignal) => {
		const delay = Math.min(REOPEN_BASE_DELAY_MS * 2 ** reopenAttempts, REOPEN_MAX_DELAY_MS)
		reopenAttempts++

		const timer = setTimeout(() => rebuilds++, delay)
		signal.addEventListener('abort', () => clearTimeout(timer))
	}

	$effect(() => {
		if (!client.current || !generation.canQuery) return

		// A rebuilt store closes the old stream, and this reopens one against the new instance.
		const isRebuild = rebuilds !== syncedRebuilds
		syncedRebuilds = rebuilds

		const controller = new AbortController()

		// The entities survived the disconnect, so any pull that ran out of client
		// mid-stream still owes its point cloud the rest of its chunks. A rebuild
		// respawns every cloud instead, since the new instance's chunks may differ.
		if (!isRebuild) chunkLoader.resume()
		// Stream first, to narrow the window `syncSnapshot` describes.
		void consumeChanges(controller.signal)
		void syncSnapshot(controller.signal, isRebuild)

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
