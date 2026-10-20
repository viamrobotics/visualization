import { FieldMask } from '@bufbuild/protobuf'

import {
	EntityChangeType,
	EntityScope,
	StreamEntityChangesResponse,
} from '$lib/buf/draw/v1/service_pb'

export interface StreamEvent {
	uuid: string
	changeType: EntityChangeType
	entity: StreamEntityChangesResponse['entity']
	updatedFields?: FieldMask
}

/**
 * Changes buffered between animation frames.
 *
 * Events are merged per UUID as they arrive rather than accumulated, so the buffer is bounded
 * by scene size. A backgrounded tab gets no `requestAnimationFrame` while the stream keeps
 * draining, which would otherwise grow an unbounded list.
 */
export interface PendingChanges {
	/** Set when a bulk removal arrived. Every entity in this scope was cleared. */
	clearedScope?: EntityScope
	/** Latest state per entity UUID, in first-mention order. */
	events: Map<string, StreamEvent>
}

export const emptyPendingChanges = (): PendingChanges => ({ events: new Map() })

export const isEmpty = (pending: PendingChanges): boolean =>
	pending.clearedScope === undefined && pending.events.size === 0

/**
 * Union two field masks, preserving order and dropping duplicates. A nil or empty mask means
 * "replace everything" and subsumes any partial mask, so the union is also empty.
 */
const unionMasks = (a: FieldMask | undefined, b: FieldMask | undefined): FieldMask | undefined => {
	if (!a?.paths.length || !b?.paths.length) return undefined

	const paths = [...a.paths]
	for (const path of b.paths) {
		if (!paths.includes(path)) paths.push(path)
	}
	return new FieldMask({ paths })
}

/**
 * Merge one incoming change into the pending buffer.
 *
 * The newest event for a UUID always wins. Every broadcast message carries the fully merged
 * entity rather than a partial, so replacing is always safe — an ADDED that follows a REMOVED
 * in the same frame is the entity's current state and must not be discarded. Discarding it is
 * what made a `RemoveAll()` + redraw loop blink entities out of the scene.
 *
 * `Map.set` on an existing key keeps its original position, so cross-entity ordering (parents
 * ahead of children) survives coalescing.
 */
export const mergeEvent = (pending: PendingChanges, event: StreamEvent): void => {
	const existing = pending.events.get(event.uuid)
	if (!existing) {
		pending.events.set(event.uuid, event)
		return
	}

	// Two partial updates merge into one carrying both masks. Anything else replaces outright, and a
	// full state supersedes whatever partial mask was pending.
	if (
		event.changeType === EntityChangeType.UPDATED &&
		existing.changeType === EntityChangeType.UPDATED
	) {
		existing.entity = event.entity
		existing.updatedFields = unionMasks(existing.updatedFields, event.updatedFields)
		return
	}

	if (
		event.changeType === EntityChangeType.UPDATED &&
		existing.changeType === EntityChangeType.ADDED
	) {
		// Still an add as far as the consumer is concerned, but carrying newer state.
		existing.entity = event.entity
		existing.updatedFields = undefined
		return
	}

	pending.events.set(event.uuid, { ...event, updatedFields: undefined })
}

/**
 * Record a bulk removal.
 *
 * Events buffered before the clear are dropped when the clear covers them: those entities are
 * gone, and any the producer immediately redraws arrive as fresh events after this point. Events
 * for a kind the clear does not cover survive, so clearing drawings does not discard a transform
 * that was added moments earlier. The clear itself is deliberately not applied as a teardown, see
 * `survivingUUIDs`.
 *
 * Two clears with different scopes in one frame both happened, so the recorded scope widens to
 * ALL rather than the second replacing the first. Replacing would leave the first scope's
 * entities behind as ghosts, since only the surviving scope is reconciled at flush.
 */
export const mergeClear = (pending: PendingChanges, scope: EntityScope): void => {
	pending.clearedScope =
		pending.clearedScope === undefined || pending.clearedScope === scope ? scope : EntityScope.ALL

	for (const [uuid, event] of pending.events) {
		if (clearCovers(scope, event)) pending.events.delete(uuid)
	}
}

/** Whether a bulk removal of this scope subsumes a buffered event for a single entity. */
const clearCovers = (scope: EntityScope, event: StreamEvent): boolean => {
	switch (event.entity.case) {
		case 'transform': {
			return clearsTransforms(scope)
		}
		case 'drawing': {
			return clearsDrawings(scope)
		}
		default: {
			return false
		}
	}
}

/**
 * UUIDs the flush is about to (re)create, and so must survive a pending clear.
 *
 * A clear followed by re-adds is how a redraw loop refreshes a scene. Destroying those entities
 * and respawning them in the same frame would churn every Three.js object for nothing, and a
 * respawned entity renders one frame at the wrong world transform because its parent link has
 * not resolved yet. Reconciling instead, destroying only what did not come back, keeps the scene
 * stable.
 */
export const survivingUUIDs = (pending: PendingChanges): Set<string> => {
	const surviving = new Set<string>()
	for (const [uuid, event] of pending.events) {
		if (event.changeType !== EntityChangeType.REMOVED) surviving.add(uuid)
	}
	return surviving
}

/** Whether a cleared scope covers transforms. */
export const clearsTransforms = (scope: EntityScope | undefined): boolean =>
	scope === EntityScope.ALL || scope === EntityScope.TRANSFORMS

/** Whether a cleared scope covers drawings. */
export const clearsDrawings = (scope: EntityScope | undefined): boolean =>
	scope === EntityScope.ALL || scope === EntityScope.DRAWINGS
