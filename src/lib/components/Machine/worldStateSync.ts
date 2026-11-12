import type { Entity, World } from 'koota'

import { Code, ConnectError } from '@connectrpc/connect'
import {
	Struct,
	type TransformChangeEvent,
	TransformChangeType,
	type TransformWithUUID,
	type WorldStateStoreClient,
} from '@viamrobotics/sdk'
import { Matrix4 } from 'three'

import type { useRelationships } from '$lib/hooks/useRelationships.svelte'
import type { useLogs } from '$lib/plugins/Logs/useLogs.svelte'

import { createChunkLoader } from '$lib/chunking'
import { drawTransform, updateMetadata } from '$lib/draw'
import { hierarchy, traits } from '$lib/ecs'
import { ChildOf } from '$lib/ecs/relations'
import { isPointCloud } from '$lib/geometry'
import { Pose } from '$lib/math'
import { metadataFromStruct } from '$lib/metadata'
import { settleWithConcurrency } from '$lib/settleWithConcurrency'

import { decodeWorldStateChunk } from './decodeWorldStateChunk'

type TransformEvent = TransformChangeEvent & {
	transform: TransformWithUUID
}

/** The calls the sync makes on a `world_state_store`. */
export type WorldStateClient = Pick<
	WorldStateStoreClient,
	'listUUIDs' | 'getTransform' | 'streamTransformChanges' | 'doCommand'
>

export interface WorldStateTiming {
	/** How long each read may take. Stream events wait on reads, so one hung request would freeze the scene. */
	readTimeoutMs: number
	/** How long a stream has to stay open to count as healthy, which resets its reopen backoff. */
	streamHealthyMs: number
	/** The first retry's delay after a stream ends or a read fails. */
	retryBaseDelayMs: number
	/** The longest a retry waits, for a server or proxy that keeps failing. */
	retryMaxDelayMs: number
}

export const DEFAULT_WORLD_STATE_TIMING: WorldStateTiming = {
	readTimeoutMs: 10_000,
	// Short enough that a proxy cutting busy streams every few tens of seconds still reopens
	// quickly, long enough that one cutting right after its first event backs off.
	streamHealthyMs: 5000,
	// Longer than svelte-sdk's 1s status poll, so a real rebuild's generation change usually
	// reopens the stream before a retry does.
	retryBaseDelayMs: 2000,
	retryMaxDelayMs: 30_000,
}

/**
 * How many `getTransform` requests a read keeps in flight, so each one's timeout starts
 * when it is sent. High enough that a store of thousands loads in a few round trips.
 */
const READ_CONCURRENCY = 64

interface WorldStateSyncOptions {
	world: World
	relationships: ReturnType<typeof useRelationships>
	logs: Pick<ReturnType<typeof useLogs>, 'add'>
	invalidate: () => void
	/** Runs `callback` before the next render, and returns a function that cancels it. */
	requestFrame: (callback: () => void) => () => void
	timing: WorldStateTiming
}

interface WorldStateSync {
	/**
	 * Hands over what the machine reports, in one call, so a rebuild and a reconnect
	 * landing together open the stream once.
	 *
	 * @param state.client The client to read through. A different one means the
	 *   connection dropped and came back. `undefined` means the store cannot be
	 *   queried right now, which closes the stream until a client arrives.
	 * @param state.generation The store's generation from the machine status. A change
	 *   between two reported values is a rebuild. The first value names the instance
	 *   already being read, and an empty one (no status yet, or a status that dropped
	 *   out) is ignored.
	 */
	update: (state: { client: WorldStateClient | undefined; generation: string }) => void
	/** Closes the stream and destroys every entity this sync drew. */
	dispose: () => void
}

/** One open stream and everything read against it. Closing aborts both. */
interface Session {
	controller: AbortController
	/** False once the stream ended on its own. Reads can still use the session. */
	isStreamOpen: boolean
	/** Whether a snapshot still has to load before only single transforms are fetched. */
	isSnapshotOwed: boolean
	/** Whether a read is in flight. Only one runs at a time. */
	isReading: boolean
}

/**
 * Mirrors one `world_state_store` into the ECS world and keeps it there through
 * rebuilds, reconnects and streams that end on their own. What it draws must never
 * be something the store no longer holds, and it pays in downloads to keep that true.
 *
 * Each time a stream opens, a snapshot is the truth: entities the store dropped are
 * destroyed, new ones are spawned, and stream events that arrive while it loads are
 * replayed on top of it in order. A rebuild respawns what an update cannot bring in
 * line, and updates everything else in place so it keeps its identity and stays
 * selected. Every retry, whatever failed, goes through one scheduler that does the
 * next thing owed: reopen the stream, take the snapshot, or fetch single transforms.
 *
 * What it cannot know, it leaves drawn: while disconnected, and while a rebuild's
 * snapshot keeps failing, the last state read stays up. A chunked cloud's points come
 * from its chunk loader, and a read carries only the first chunk, so outside a rebuild
 * a read moves such a cloud but cannot see whether its points changed.
 */
export const createWorldStateSync = ({
	world,
	relationships,
	logs,
	invalidate,
	requestFrame,
	timing,
}: WorldStateSyncOptions): WorldStateSync => {
	let client: WorldStateClient | undefined
	let session: Session | undefined

	// The last generation the status reported. Empty until the first status arrives.
	let lastGeneration = ''
	// Rebuilds requested and rebuilds drawn. A rebuild is pending while they differ, and a
	// rebuild snapshot draws only up to the request it started with.
	let rebuildSeq = 0
	let drawnRebuildSeq = 0

	// One retry at a time, whatever asked for it. Stream ends and failed reads back off on
	// their own counts: a stream reset needs it to stay open, a read reset needs it to load.
	let retryTimer: ReturnType<typeof setTimeout> | undefined
	let streamEndsInARow = 0
	let failedReadsInARow = 0

	// Failures already logged, so one that keeps failing logs once, however often it is
	// retried or the stream reopens. A read that loads forgets it, as does a snapshot that
	// no longer lists it or a stream that removes it.
	let isSnapshotFailureLogged = false
	const loggedFailingUUIDs = new Set<string>()

	const entities = new Map<string, Entity>()
	// The geometry kind the store sent, by uuid. A changed kind means a respawn.
	// The traits cannot say: a cloud reads as a bare frame until its worker parse lands.
	const geometryKinds = new Map<string, string | undefined>()
	// The metadata fields last drawn, by uuid. `updateMetadata` cannot clear a field the
	// store dropped, such as colors, so a snapshot without one respawns instead.
	const metadataFields = new Map<string, Set<string>>()
	// Serialized metadata a read last applied, by uuid, so a repeat changes nothing.
	// Stream updates clear it: serializing per-point colors on the hot path is costly.
	const metadataFingerprints = new Map<string, string>()
	// The inline points an unchunked cloud was last drawn from, by uuid, so a read repeating
	// them skips the worker parse. Kept by reference, the way meshes keep their source.
	const cloudSources = new Map<string, Uint8Array>()
	// Reused for comparing a read pose against the drawn one.
	const scratchPose = new Pose()
	const nextMatrix = new Matrix4()

	// UUIDs to fetch on their own: failed reads, stream updates for what is not drawn, and
	// stream updates to a chunked cloud's points.
	const dirtyUUIDs = new Set<string>()

	// Stream events wait while a read runs: all of them for a snapshot, only its own uuids'
	// for a fetch of single transforms, so a few failing transforms never stall the rest.
	// A removal that arrives during a read is held with the rest, so the read cannot draw
	// back what it removed.
	let held: 'all' | Set<string> | undefined
	let cancelFlush: (() => void) | undefined
	let pendingEvents: TransformEvent[] = []

	const chunkLoader = createChunkLoader({
		world,
		invalidate,
		fetchChunk: async (uuid, start, signal) => {
			const activeClient = client
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

	const isRebuildPending = () => rebuildSeq !== drawnRebuildSeq

	const metadataFingerprint = (transform: TransformWithUUID) =>
		JSON.stringify(transform.metadata ?? null)

	const metadataFieldNames = (transform: TransformWithUUID) =>
		new Set(Object.keys(transform.metadata?.fields ?? {}))

	/** Whether a transform's points arrive in chunks, so that it carries only the first. */
	const isChunked = (transform: TransformWithUUID) =>
		Object.hasOwn(transform.metadata?.fields ?? {}, 'chunks')

	const cloudBytes = (transform: TransformWithUUID) => {
		const geometryType = transform.physicalObject?.geometryType
		return geometryType?.case === 'pointcloud' ? geometryType.value.pointCloud : undefined
	}

	const areBytesEqual = (a: Uint8Array, b: Uint8Array) =>
		a.length === b.length && a.every((byte, index) => byte === b[index])

	/** Records the inline points an unchunked cloud is drawn from, for `refreshEntity` to compare. */
	const recordCloudSource = (transform: TransformWithUUID) => {
		const bytes = cloudBytes(transform)
		if (bytes && !isChunked(transform)) cloudSources.set(transform.uuidString, bytes)
		else cloudSources.delete(transform.uuidString)
	}

	const spawnEntity = (transform: TransformWithUUID) => {
		const uuid = transform.uuidString
		if (entities.has(uuid)) return

		const spawned = drawTransform(world, transform, traits.WorldStateStoreAPI, { removable: false })
		entities.set(uuid, spawned.entity)
		geometryKinds.set(uuid, transform.physicalObject?.geometryType?.case)
		metadataFields.set(uuid, metadataFieldNames(transform))
		recordCloudSource(transform)
		relationships.apply(spawned.entity, spawned.relationships)

		const parsedMetadata = metadataFromStruct(transform.metadata?.fields)
		chunkLoader.start(uuid, spawned.entity, parsedMetadata)
		relationships.flush(uuid)

		if (isPointCloud(transform.physicalObject?.geometryType)) invalidate()
	}

	const destroyEntity = (uuid: string) => {
		chunkLoader.stop(uuid)
		geometryKinds.delete(uuid)
		metadataFields.delete(uuid)
		metadataFingerprints.delete(uuid)
		cloudSources.delete(uuid)

		const entity = entities.get(uuid)
		if (!entity) return

		if (world.has(entity)) entity.destroy()
		entities.delete(uuid)
	}

	/**
	 * Destroys the entity for `uuid` and re-orphans its children by its name, so they
	 * reattach to whatever is spawned under that name next. The hierarchy does not
	 * reattach the children of a destroyed parent on its own.
	 */
	const destroyKeepingChildren = (uuid: string) => {
		const entity = entities.get(uuid)
		const parentName = entity?.get(traits.Name)
		const children = entity ? [...world.query(ChildOf(entity))] : []

		destroyEntity(uuid)

		for (const child of children) {
			if (child.isAlive()) hierarchy.setParent(child, parentName)
		}
	}

	// FieldMask paths are proto field names; spec-compliant backends emit
	// snake_case (`pose_in_observer_frame`) while some emit camelCase. Normalize
	// to camelCase so matching against the message's accessors is casing-agnostic.
	const snakeToCamel = (path: string): string =>
		path.replaceAll(/_([a-z])/g, (_, char: string) => char.toUpperCase())

	/** Moves an entity to a transform's pose, marking it changed only if the pose differs. */
	const applyPose = (entity: Entity, transform: TransformWithUUID) => {
		scratchPose.copy(transform.poseInObserverFrame?.pose).toMatrix4(nextMatrix)
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
		const uuid = transform.uuidString
		const entity = entities.get(uuid)

		// An update carries only what changed, so what is not drawn has to be fetched whole.
		if (!entity) {
			markDirty(uuid)
			return
		}

		let metadataDirty = false

		for (const rawPath of changes) {
			if (typeof rawPath !== 'string') continue

			const path = snakeToCamel(rawPath)

			if (path.startsWith('poseInObserverFrame')) {
				applyPose(entity, transform)
			} else if (path.startsWith('physicalObject') && transform.physicalObject) {
				// No convention says a chunked cloud's update carries every point, and only a
				// fresh spawn restarts its loader. Fetch it whole instead.
				if (metadataFields.get(uuid)?.has('chunks')) {
					destroyKeepingChildren(uuid)
					markDirty(uuid)
					return
				}

				traits.updateGeometryTrait(entity, transform.physicalObject)
				geometryKinds.set(uuid, transform.physicalObject.geometryType?.case)
				recordCloudSource(transform)
			} else if (path.startsWith('metadata')) {
				metadataDirty = true
			}
		}

		if (metadataDirty) {
			metadataFingerprints.delete(uuid)
			metadataFields.set(uuid, metadataFieldNames(transform))
			const parsedMetadata = metadataFromStruct(transform.metadata?.fields)
			updateMetadata(entity, parsedMetadata, {
				pointCloud: isPointCloud(transform.physicalObject?.geometryType),
			})
			relationships.apply(entity, parsedMetadata.relationships)
		}
	}

	/**
	 * Brings a drawn entity in line with a read transform, touching only what differs,
	 * so a read repeating the scene marks nothing changed. A chunked cloud only moves:
	 * its points came from the chunk loader, and a read carries only the first chunk.
	 */
	const refreshEntity = (entity: Entity, transform: TransformWithUUID) => {
		applyPose(entity, transform)

		const isCloud = isPointCloud(transform.physicalObject?.geometryType)
		if (isCloud && isChunked(transform)) return

		const uuid = transform.uuidString
		if (transform.physicalObject) {
			// Primitives and meshes compare themselves. A cloud would reparse in a worker
			// unconditionally, so its inline points are compared here first.
			const bytes = cloudBytes(transform)
			const drawnBytes = cloudSources.get(uuid)
			const isUnchangedCloud = bytes && drawnBytes && areBytesEqual(bytes, drawnBytes)
			if (!isUnchangedCloud) {
				traits.updateGeometryTrait(entity, transform.physicalObject)
				recordCloudSource(transform)
			}
		}

		const parsedMetadata = metadataFromStruct(transform.metadata?.fields)
		const fingerprint = metadataFingerprint(transform)
		if (metadataFingerprints.get(uuid) !== fingerprint) {
			metadataFingerprints.set(uuid, fingerprint)
			metadataFields.set(uuid, metadataFieldNames(transform))
			updateMetadata(entity, parsedMetadata, { pointCloud: isCloud })
		}

		// Always, since a target respawned in the same read needs its link restored.
		// Applying links that already exist changes nothing.
		relationships.apply(entity, parsedMetadata.relationships)
	}

	/**
	 * Whether a drawn entity has to be respawned to match a read transform. An update
	 * never renames, cannot remove geometry, and cannot clear a metadata field. On a
	 * rebuild, a drawn cloud holds chunks from the old instance, and only a respawn
	 * restarts the loader against the new one. A cloud that starts or stops arriving in
	 * chunks needs its loader started or stopped the same way.
	 */
	const mustRespawn = (entity: Entity, transform: TransformWithUUID, isRebuild: boolean) => {
		const uuid = transform.uuidString
		if (isRebuild && isPointCloud(transform.physicalObject?.geometryType)) return true
		if (geometryKinds.get(uuid) !== transform.physicalObject?.geometryType?.case) return true
		if (entity.get(traits.Name) !== transform.referenceFrame) return true

		const drawnFields = metadataFields.get(uuid) ?? new Set<string>()
		const nextFields = metadataFieldNames(transform)
		if (drawnFields.has('chunks') !== nextFields.has('chunks')) return true
		for (const field of drawnFields) {
			if (!nextFields.has(field)) return true
		}
		return false
	}

	/**
	 * Draws read transforms. An entity an update cannot bring in line is respawned, and
	 * anything else updates in place, so it keeps its identity and stays selected.
	 *
	 * Respawns are destroyed before anything spawns, and updates run last. A link to
	 * a respawned target then waits in the relationship registry and lands on the new
	 * entity, instead of being kept on the old one and dropped with it.
	 */
	const applyRead = (transforms: TransformWithUUID[], isRebuild: boolean) => {
		const spawns: TransformWithUUID[] = []
		const refreshes: Array<{ entity: Entity; transform: TransformWithUUID }> = []

		for (const transform of transforms) {
			const entity = entities.get(transform.uuidString)

			if (entity && !mustRespawn(entity, transform, isRebuild)) {
				refreshes.push({ entity, transform })
				continue
			}

			if (entity) destroyKeepingChildren(transform.uuidString)
			spawns.push(transform)
		}

		for (const transform of spawns) {
			spawnEntity(transform)
			// A chunked cloud's metadata is never refreshed, so its fingerprint would never be read.
			const isChunkedCloud =
				isPointCloud(transform.physicalObject?.geometryType) && isChunked(transform)
			if (!isChunkedCloud) {
				metadataFingerprints.set(transform.uuidString, metadataFingerprint(transform))
			}
		}

		for (const { entity, transform } of refreshes) refreshEntity(entity, transform)
		invalidate()
	}

	/**
	 * Fetches `uuids` and draws what loads.
	 *
	 * Settled, not all: one unreadable transform drops itself rather than the whole read.
	 *
	 * @returns The uuids whose fetch failed.
	 */
	const fetchAndDraw = async (
		activeClient: WorldStateClient,
		signal: AbortSignal,
		uuids: string[],
		isRebuild: boolean
	) => {
		const transforms = await settleWithConcurrency(uuids, READ_CONCURRENCY, async (uuid) => {
			// Without this, an aborted read still sends one request per uuid left in the queue.
			if (signal.aborted) throw signal.reason
			return activeClient.getTransform(uuid, undefined, {
				signal: AbortSignal.any([signal, AbortSignal.timeout(timing.readTimeoutMs)]),
			})
		})
		if (signal.aborted) return []

		applyRead(
			transforms.flatMap((transform) =>
				transform.status === 'fulfilled' ? [transform.value] : []
			),
			isRebuild
		)

		const failedUUIDs: string[] = []
		for (const [index, uuid] of uuids.entries()) {
			if (transforms[index]?.status === 'rejected') {
				failedUUIDs.push(uuid)
			} else {
				loggedFailingUUIDs.delete(uuid)
			}
		}
		return failedUUIDs
	}

	/** Logs transforms that failed to load, each only the first time it fails. */
	const logFailedFetches = (failedUUIDs: string[], requested: number) => {
		const newlyFailing = failedUUIDs.filter((uuid) => !loggedFailingUUIDs.has(uuid))
		if (newlyFailing.length === 0) return

		logs.add(
			`World state store: ${newlyFailing.length} of ${requested} transforms failed`,
			'error',
			{
				folder: 'world-state-store',
			}
		)
		for (const uuid of newlyFailing) loggedFailingUUIDs.add(uuid)
	}

	/**
	 * Lists the store and draws everything in it, as the truth. The stream reports only
	 * changes made after it opens, so whatever the store gained or lost while none was
	 * open (a reconnect, a rebuild) shows up only here. Stream events wait until it is
	 * drawn, then replay on top of it in order, so a later change wins.
	 *
	 * Drawn clouds are fetched too, so a cloud moved while the connection was down moves.
	 * Outside a rebuild only their pose is applied, since a read carries their first chunk.
	 *
	 * The stream is opened first, but the server gives no sign that it has subscribed, so a
	 * change landing between the two can still be missed until the next snapshot.
	 */
	const readSnapshot = async (activeClient: WorldStateClient, current: Session) => {
		const { signal } = current.controller
		const rebuildSeqAtStart = rebuildSeq
		const isRebuild = isRebuildPending()

		held = 'all'

		try {
			const uuids = await activeClient.listUUIDs(undefined, {
				signal: AbortSignal.any([signal, AbortSignal.timeout(timing.readTimeoutMs)]),
			})
			if (signal.aborted) return

			// Diffed against `uuids`, not the transforms that load, so an unreadable
			// transform is not mistaken for one the store dropped.
			const snapshotUUIDs = new Set(uuids)
			for (const uuid of entities.keys()) {
				if (!snapshotUUIDs.has(uuid)) destroyEntity(uuid)
			}
			for (const uuid of loggedFailingUUIDs) {
				if (!snapshotUUIDs.has(uuid)) loggedFailingUUIDs.delete(uuid)
			}
			dirtyUUIDs.clear()

			const failedUUIDs = await fetchAndDraw(activeClient, signal, uuids, isRebuild)
			if (signal.aborted) return

			current.isSnapshotOwed = false
			isSnapshotFailureLogged = false
			drawnRebuildSeq = rebuildSeqAtStart

			for (const uuid of failedUUIDs) {
				// On a rebuild, what failed to load is the old instance's, frame or cloud alike.
				// Removing it is honest, and the retry fetches it as new.
				if (isRebuild) destroyKeepingChildren(uuid)
				dirtyUUIDs.add(uuid)
			}
			logFailedFetches(failedUUIDs, uuids.length)

			if (failedUUIDs.length === 0) failedReadsInARow = 0
			else scheduleRetry(++failedReadsInARow)
		} catch (error) {
			if (signal.aborted) return

			if (!isSnapshotFailureLogged) {
				logs.add('World state store: could not load the current transforms', 'error', {
					folder: 'world-state-store',
				})
				isSnapshotFailureLogged = true
			}
			console.error('World state snapshot failed:', error)

			scheduleRetry(++failedReadsInARow)
		}
	}

	/**
	 * Fetches transforms owed on their own: ones that failed to load, and ones a stream
	 * update named before they were drawn. Only their own events wait.
	 */
	const readDirty = async (activeClient: WorldStateClient, current: Session) => {
		const { signal } = current.controller
		const uuids = [...dirtyUUIDs]
		dirtyUUIDs.clear()
		if (uuids.length === 0) return

		held = new Set(uuids)

		try {
			const failedUUIDs = await fetchAndDraw(activeClient, signal, uuids, false)
			if (signal.aborted) return

			for (const uuid of failedUUIDs) dirtyUUIDs.add(uuid)
			logFailedFetches(failedUUIDs, uuids.length)

			if (failedUUIDs.length === 0) failedReadsInARow = 0
			else scheduleRetry(++failedReadsInARow)
		} catch (error) {
			if (signal.aborted) return

			// Drawing threw, so none of them can be trusted as drawn. Try them all again.
			console.error('World state fetch failed:', error)
			for (const uuid of uuids) dirtyUUIDs.add(uuid)
			scheduleRetry(++failedReadsInARow)
		}
	}

	/**
	 * Does the next thing owed, if nothing is in flight: reopen a stream that ended, take a
	 * snapshot that has not loaded, or fetch transforms owed on their own.
	 */
	const resync = () => {
		const activeClient = client
		if (!activeClient) return

		if (!session?.isStreamOpen) {
			open()
			return
		}

		const current = session
		if (current.isReading) return
		if (!current.isSnapshotOwed && dirtyUUIDs.size === 0) return

		current.isReading = true
		const read = current.isSnapshotOwed
			? readSnapshot(activeClient, current)
			: readDirty(activeClient, current)

		void read.finally(() => {
			if (session !== current) return

			current.isReading = false
			held = undefined
			if (pendingEvents.length > 0) scheduleFlush()

			// Owed work with no retry waiting came from a stream update, so it runs now.
			if (retryTimer === undefined) resync()
		})
	}

	/** Runs `resync` after a backoff. One retry waits at a time, whichever failure asked first. */
	const scheduleRetry = (failuresInARow: number) => {
		if (retryTimer !== undefined) return

		const delay = Math.min(
			timing.retryBaseDelayMs * 2 ** (failuresInARow - 1),
			timing.retryMaxDelayMs
		)
		retryTimer = setTimeout(() => {
			retryTimer = undefined
			resync()
		}, delay)
	}

	/**
	 * Adds `uuid` to what is owed on its own, and fetches it now unless a read is in flight
	 * or a retry is waiting. Either of those picks it up when it runs.
	 */
	const markDirty = (uuid: string) => {
		dirtyUUIDs.add(uuid)
		if (retryTimer === undefined) resync()
	}

	/**
	 * Marks a rebuild pending, for the next snapshot to draw on the rebuild path. Cloud
	 * pulls stop now: the old instance's offsets mean nothing against the new one, and a
	 * pull left running would write its chunks into the old buffers until then.
	 */
	const requestRebuild = () => {
		rebuildSeq++
		for (const [uuid, kind] of geometryKinds) {
			if (kind === 'pointcloud') chunkLoader.stop(uuid)
		}
	}

	const applyEvents = (events: TransformEvent[]) => {
		for (const event of events) {
			const uuid = event.transform.uuidString

			if (event.changeType === TransformChangeType.ADDED) {
				spawnEntity(event.transform)
			} else if (event.changeType === TransformChangeType.REMOVED) {
				dirtyUUIDs.delete(uuid)
				loggedFailingUUIDs.delete(uuid)
				destroyEntity(uuid)
			} else if (event.changeType === TransformChangeType.UPDATED) {
				updateEntity(event.transform, event.updatedFields?.paths ?? [])
			} else {
				console.error('Unspecified change type.', event)
			}
		}

		invalidate()
	}

	const scheduleFlush = () => {
		if (cancelFlush || held === 'all') return

		cancelFlush = requestFrame(() => {
			cancelFlush = undefined

			// A flush scheduled before a snapshot began still lands during it. It must apply
			// nothing: the snapshot's own finish replays what it held.
			const heldUUIDs = held
			if (heldUUIDs === 'all') return

			if (heldUUIDs === undefined) {
				const toApply = pendingEvents
				pendingEvents = []
				applyEvents(toApply)
				return
			}

			const isHeld = (event: TransformEvent) => heldUUIDs.has(event.transform.uuidString)
			const toApply = pendingEvents.filter((event) => !isHeld(event))
			pendingEvents = pendingEvents.filter((event) => isHeld(event))
			applyEvents(toApply)
		})
	}

	/**
	 * Consumes the `streamTransformChanges` server stream directly, as `useDrawService`
	 * does. Each event goes into `pendingEvents`, which a flush applies and empties,
	 * except for events a read is holding, which wait for it to finish.
	 *
	 * A stream that ends on its own is reopened after a backoff. With no generation ever
	 * reported, its end is the only sign the instance may have changed, so it also marks a
	 * rebuild. A store that answers `Unimplemented` cannot stream, so its stream is left
	 * closed and the session stays open for snapshots.
	 */
	const consumeChanges = async (activeClient: WorldStateClient, current: Session) => {
		const { signal } = current.controller
		const openedAt = Date.now()

		try {
			for await (const event of activeClient.streamTransformChanges(undefined, { signal })) {
				if (signal.aborted) break
				if (!event.transform) continue

				pendingEvents.push(event as TransformEvent)
				scheduleFlush()
			}
		} catch (error) {
			if (signal.aborted) return

			console.error('World state transform stream error:', error)

			// The stream will never come, but snapshots still can. The session stays open for them.
			if (ConnectError.from(error).code === Code.Unimplemented) {
				logs.add(
					'World state store: this store does not stream changes, so the scene will not update live',
					'error',
					{ folder: 'world-state-store' }
				)
				return
			}

			logs.add('World state store: transform stream failed', 'error', {
				folder: 'world-state-store',
			})
		}

		if (signal.aborted) return

		current.isStreamOpen = false

		// With no generation ever reported, nothing else can say the instance changed, and
		// only the rebuild path is safe if it did. With one, a rebuild changes it.
		if (lastGeneration === '') requestRebuild()

		if (Date.now() - openedAt >= timing.streamHealthyMs) streamEndsInARow = 0
		scheduleRetry(++streamEndsInARow)
	}

	/** Closes the stream and its reads, and drops every retry and owed fetch. */
	const close = () => {
		session?.controller.abort()
		session = undefined
		held = undefined
		cancelFlush?.()
		cancelFlush = undefined
		// What the old stream buffered describes a stream being left. The next snapshot covers it.
		pendingEvents = []

		// The next snapshot reads everything, so these are moot. Which failures were logged is
		// kept, so a reopen does not log them again.
		clearTimeout(retryTimer)
		retryTimer = undefined
		failedReadsInARow = 0
		dirtyUUIDs.clear()
	}

	/**
	 * Opens a stream and its snapshot against the current client, closing any open one.
	 * A pending rebuild takes the rebuild path. Anything else is a reconnect to the same
	 * instance, so pulls that ran out of client mid-stream resume where they stopped.
	 */
	const open = () => {
		close()

		const activeClient = client
		if (!activeClient) return

		const current: Session = {
			controller: new AbortController(),
			isStreamOpen: true,
			isSnapshotOwed: true,
			isReading: false,
		}
		session = current

		if (!isRebuildPending()) chunkLoader.resume()
		// Stream first, to narrow the window `readSnapshot` describes.
		void consumeChanges(activeClient, current)
		resync()
	}

	return {
		update(state) {
			const isRebuild =
				state.generation !== '' && lastGeneration !== '' && state.generation !== lastGeneration
			if (state.generation !== '') lastGeneration = state.generation
			if (isRebuild) requestRebuild()

			const isNewClient = state.client !== client
			client = state.client

			if (!client) {
				close()
			} else if (isRebuild || isNewClient) {
				open()
			}
		},

		dispose() {
			close()
			chunkLoader.dispose()
			for (const entity of entities.values()) {
				if (world.has(entity)) entity.destroy()
			}
			entities.clear()
		},
	}
}
