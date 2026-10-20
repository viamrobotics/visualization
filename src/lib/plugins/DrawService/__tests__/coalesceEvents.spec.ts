import { FieldMask } from '@bufbuild/protobuf'
import { describe, expect, it } from 'vitest'

import { Transform } from '$lib/buf/common/v1/common_pb'
import { Drawing } from '$lib/buf/draw/v1/drawing_pb'
import { EntityChangeType, EntityScope } from '$lib/buf/draw/v1/service_pb'

import {
	clearsDrawings,
	clearsTransforms,
	emptyPendingChanges,
	isEmpty,
	mergeClear,
	mergeEvent,
	type StreamEvent,
	survivingUUIDs,
} from '../coalesceEvents'

const event = (
	uuid: string,
	changeType: EntityChangeType,
	referenceFrame = uuid,
	updatedFields?: FieldMask
): StreamEvent => ({
	uuid,
	changeType,
	entity: { case: 'transform', value: new Transform({ referenceFrame }) },
	updatedFields,
})

const drawingEvent = (uuid: string, changeType: EntityChangeType): StreamEvent => ({
	uuid,
	changeType,
	entity: { case: 'drawing', value: new Drawing({ referenceFrame: uuid }) },
})

const frameOf = (e: StreamEvent | undefined) =>
	e?.entity.case === 'transform' ? e.entity.value.referenceFrame : undefined

const types = (pending: ReturnType<typeof emptyPendingChanges>) =>
	[...pending.events.values()].map((e) => e.changeType)

describe('mergeEvent', () => {
	it('keeps the first event for a new uuid', () => {
		const pending = emptyPendingChanges()
		mergeEvent(pending, event('a', EntityChangeType.ADDED))

		expect(pending.events.size).toBe(1)
		expect(types(pending)).toEqual([EntityChangeType.ADDED])
	})

	// The reported bug: RemoveAll() followed by a redraw emits REMOVED then ADDED on the same
	// deterministic uuid. Discarding the re-add blinked entities out of the scene.
	it('lets ADDED override a pending REMOVED, carrying the new payload', () => {
		const pending = emptyPendingChanges()
		mergeEvent(pending, event('a', EntityChangeType.REMOVED, 'old'))
		mergeEvent(pending, event('a', EntityChangeType.ADDED, 'new'))

		expect(pending.events.size).toBe(1)
		expect(types(pending)).toEqual([EntityChangeType.ADDED])
		expect(frameOf(pending.events.get('a'))).toBe('new')
	})

	it('lets REMOVED override a pending ADDED', () => {
		const pending = emptyPendingChanges()
		mergeEvent(pending, event('a', EntityChangeType.ADDED))
		mergeEvent(pending, event('a', EntityChangeType.REMOVED))

		expect(types(pending)).toEqual([EntityChangeType.REMOVED])
	})

	it('keeps ADDED when a later UPDATED arrives, taking the newer payload', () => {
		const pending = emptyPendingChanges()
		mergeEvent(pending, event('a', EntityChangeType.ADDED, 'first'))
		mergeEvent(
			pending,
			event('a', EntityChangeType.UPDATED, 'second', new FieldMask({ paths: ['metadata'] }))
		)

		expect(types(pending)).toEqual([EntityChangeType.ADDED])
		expect(frameOf(pending.events.get('a'))).toBe('second')
		expect(pending.events.get('a')?.updatedFields).toBeUndefined()
	})

	it('unions the masks of two partial updates', () => {
		const pending = emptyPendingChanges()
		mergeEvent(
			pending,
			event('a', EntityChangeType.UPDATED, 'first', new FieldMask({ paths: ['metadata'] }))
		)
		mergeEvent(
			pending,
			event(
				'a',
				EntityChangeType.UPDATED,
				'second',
				new FieldMask({ paths: ['pose_in_observer_frame', 'metadata'] })
			)
		)

		expect(pending.events.get('a')?.updatedFields?.paths).toEqual([
			'metadata',
			'pose_in_observer_frame',
		])
		expect(frameOf(pending.events.get('a'))).toBe('second')
	})

	it('treats a full update as superseding a pending partial one', () => {
		const pending = emptyPendingChanges()
		mergeEvent(
			pending,
			event('a', EntityChangeType.UPDATED, 'first', new FieldMask({ paths: ['metadata'] }))
		)
		mergeEvent(pending, event('a', EntityChangeType.UPDATED, 'second'))

		expect(pending.events.get('a')?.updatedFields).toBeUndefined()
	})

	it('lets UPDATED override a pending REMOVED', () => {
		const pending = emptyPendingChanges()
		mergeEvent(pending, event('a', EntityChangeType.REMOVED))
		mergeEvent(pending, event('a', EntityChangeType.UPDATED, 'back'))

		expect(types(pending)).toEqual([EntityChangeType.UPDATED])
		expect(frameOf(pending.events.get('a'))).toBe('back')
	})

	it('preserves first-mention order when an earlier uuid is updated again', () => {
		const pending = emptyPendingChanges()
		mergeEvent(pending, event('a', EntityChangeType.ADDED))
		mergeEvent(pending, event('b', EntityChangeType.ADDED))
		mergeEvent(pending, event('c', EntityChangeType.ADDED))
		mergeEvent(pending, event('a', EntityChangeType.UPDATED))

		expect([...pending.events.keys()]).toEqual(['a', 'b', 'c'])
	})
})

describe('mergeClear', () => {
	it('drops events buffered before the clear', () => {
		const pending = emptyPendingChanges()
		mergeEvent(pending, event('a', EntityChangeType.ADDED))
		mergeClear(pending, EntityScope.ALL)

		expect(pending.events.size).toBe(0)
		expect(pending.clearedScope).toBe(EntityScope.ALL)
	})

	it('keeps events that arrive after the clear', () => {
		const pending = emptyPendingChanges()
		mergeClear(pending, EntityScope.ALL)
		mergeEvent(pending, event('a', EntityChangeType.ADDED))

		expect([...pending.events.keys()]).toEqual(['a'])
		expect(pending.clearedScope).toBe(EntityScope.ALL)
	})

	it('widens to ALL when two different scopes are cleared in one frame', () => {
		const pending = emptyPendingChanges()
		mergeClear(pending, EntityScope.TRANSFORMS)
		mergeClear(pending, EntityScope.DRAWINGS)

		expect(pending.clearedScope).toBe(EntityScope.ALL)
	})

	it('does not widen when the same scope is cleared twice', () => {
		const pending = emptyPendingChanges()
		mergeClear(pending, EntityScope.DRAWINGS)
		mergeClear(pending, EntityScope.DRAWINGS)

		expect(pending.clearedScope).toBe(EntityScope.DRAWINGS)
	})

	it('keeps a buffered event of a kind the clear does not cover', () => {
		const pending = emptyPendingChanges()
		mergeEvent(pending, event('t', EntityChangeType.ADDED))
		mergeEvent(pending, drawingEvent('d', EntityChangeType.ADDED))
		mergeClear(pending, EntityScope.DRAWINGS)

		expect([...pending.events.keys()]).toEqual(['t'])
	})

	it('drops buffered events of a kind the clear does cover', () => {
		const pending = emptyPendingChanges()
		mergeEvent(pending, event('t', EntityChangeType.ADDED))
		mergeClear(pending, EntityScope.TRANSFORMS)

		expect(pending.events.size).toBe(0)
	})
})

describe('survivingUUIDs', () => {
	it('returns uuids re-added after a clear, excluding removals', () => {
		const pending = emptyPendingChanges()
		mergeClear(pending, EntityScope.ALL)
		mergeEvent(pending, event('a', EntityChangeType.ADDED))
		mergeEvent(pending, event('b', EntityChangeType.UPDATED))
		mergeEvent(pending, event('c', EntityChangeType.REMOVED))

		expect(survivingUUIDs(pending)).toEqual(new Set(['a', 'b']))
	})
})

describe('isEmpty', () => {
	it('is true only when nothing is buffered', () => {
		const pending = emptyPendingChanges()
		expect(isEmpty(pending)).toBe(true)

		mergeClear(pending, EntityScope.TRANSFORMS)
		expect(isEmpty(pending)).toBe(false)
	})
})

describe('clear scopes', () => {
	it('maps each scope to the entity kinds it covers', () => {
		expect(clearsTransforms(EntityScope.ALL)).toBe(true)
		expect(clearsDrawings(EntityScope.ALL)).toBe(true)

		expect(clearsTransforms(EntityScope.TRANSFORMS)).toBe(true)
		expect(clearsDrawings(EntityScope.TRANSFORMS)).toBe(false)

		expect(clearsTransforms(EntityScope.DRAWINGS)).toBe(false)
		expect(clearsDrawings(EntityScope.DRAWINGS)).toBe(true)

		expect(clearsTransforms(undefined)).toBe(false)
		expect(clearsDrawings(undefined)).toBe(false)
	})
})
