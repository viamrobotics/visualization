import type { ChangeMessage, ProcessMessage, UpdatedEvent } from '$lib/world-state-messages'
import { getIn, getInUnsafe, toPath } from '@thi.ng/paths'
import {
	TransformChangeType,
	type TransformChangeEvent,
	type TransformWithUUID,
} from '@viamrobotics/sdk'

interface DeduplicationEntry {
	type: TransformChangeType
	uuidString: string
	transform?: TransformWithUUID
	changes?: UpdatedEvent['changes']
}

const createEntry = (event: TransformChangeEvent): DeduplicationEntry | undefined => {
	if (!event.transform) return undefined
	switch (event.changeType) {
		case TransformChangeType.ADDED:
			return {
				type: event.changeType,
				uuidString: event.transform.uuidString,
				transform: event.transform,
			}
		case TransformChangeType.REMOVED:
			return {
				type: event.changeType,
				uuidString: event.transform.uuidString,
			}
		case TransformChangeType.UPDATED: {
			const changes: UpdatedEvent['changes'] = []
			const paths = event.updatedFields?.paths ?? []
			for (const path of paths) {
				const pathArray = toPath(path)
				changes.push([pathArray, getInUnsafe(event.transform, pathArray)])
			}

			return {
				type: event.changeType,
				uuidString: event.transform.uuidString,
				transform: event.transform,
				changes,
			}
		}
	}
}

self.onmessage = (e: MessageEvent<ChangeMessage>) => {
	const { events } = e.data
	if (events.length === 0) return

	const eventsByUUID = new Map<string, DeduplicationEntry>()

	for (const event of events) {
		const entry = createEntry(event)
		if (!entry) continue

		const uuid = entry.uuidString
		const existing = eventsByUUID.get(uuid)
		if (!existing) {
			eventsByUUID.set(uuid, entry)
			continue
		}

		switch (entry.type) {
			case TransformChangeType.REMOVED:
				eventsByUUID.set(uuid, entry)
				break

			case TransformChangeType.ADDED:
				if (existing.type !== TransformChangeType.REMOVED) eventsByUUID.set(uuid, entry)
				break

			case TransformChangeType.UPDATED:
				// merge with existing updated event
				if (existing.type === TransformChangeType.UPDATED) {
					const paths = toPath(event.updatedFields?.paths ?? [])
					if (paths.length === 0) continue
					for (const path of paths) {
						if (!existing.changes) existing.changes = []
						existing.changes.push([toPath(path), getInUnsafe(entry.transform, path)])
					}
					existing.transform = event.transform
				}
				break
		}
	}

	const processedEvents: ProcessMessage['events'] = []
	for (const entry of eventsByUUID.values()) {
		switch (entry.type) {
			case TransformChangeType.ADDED:
				if (!entry.transform) continue
				processedEvents.push({
					type: TransformChangeType.ADDED,
					uuidString: entry.uuidString,
					transform: entry.transform,
				})
				break

			case TransformChangeType.REMOVED:
				processedEvents.push({
					type: TransformChangeType.REMOVED,
					uuidString: entry.uuidString,
				})
				break

			case TransformChangeType.UPDATED: {
				const changes = entry.changes ?? []
				if (changes.length === 0) continue

				processedEvents.push({
					type: TransformChangeType.UPDATED,
					uuidString: entry.uuidString,
					changes,
				})
				break
			}
		}
	}

	const message: ProcessMessage = {
		type: 'process',
		events: processedEvents,
	}

	self.postMessage(message)
}

export {}
