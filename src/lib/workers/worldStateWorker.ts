import type {
	ChangeMessage,
	ProcessMessage,
	AddedEvent,
	RemovedEvent,
	UpdatedEvent,
} from '$lib/world-state-messages'
import { TransformChangeType, type TransformChangeEvent } from '@viamrobotics/sdk'

const createEntry = (
	event: TransformChangeEvent
): AddedEvent | RemovedEvent | UpdatedEvent | undefined => {
	if (event.transform === undefined) {
		return
	}

	switch (event.changeType) {
		case TransformChangeType.ADDED:
			return {
				changeType: event.changeType,
				uuidString: event.transform.uuidString,
				transform: event.transform,
			}
		case TransformChangeType.REMOVED:
			return {
				changeType: event.changeType,
				uuidString: event.transform.uuidString,
			}
		case TransformChangeType.UPDATED: {
			return {
				changeType: event.changeType,
				uuidString: event.transform.uuidString,
				transform: event.transform,
				changes: event.updatedFields?.paths ?? [],
			}
		}
	}
}

self.onmessage = (e: MessageEvent<ChangeMessage>) => {
	const { events } = e.data
	if (events.length === 0) return

	const eventsByUUID = new Map<string, AddedEvent | RemovedEvent | UpdatedEvent | undefined>()

	for (const event of events) {
		if (!event.transform) {
			continue
		}

		const entry = createEntry(event)
		if (!entry) continue

		const uuid = entry.uuidString
		const existing = eventsByUUID.get(uuid)
		if (!existing) {
			eventsByUUID.set(uuid, entry)
			continue
		}

		switch (entry.changeType) {
			case TransformChangeType.REMOVED:
				eventsByUUID.set(uuid, entry)
				break

			case TransformChangeType.ADDED:
				if (existing.changeType !== TransformChangeType.REMOVED) {
					eventsByUUID.set(uuid, entry)
				}
				break

			case TransformChangeType.UPDATED:
				// merge with existing updated event
				if (existing.changeType === TransformChangeType.UPDATED) {
					const paths = event.updatedFields?.paths ?? []
					if (paths.length === 0) continue
					for (const path of paths) {
						if (existing.changes.includes(path)) {
							continue
						}

						existing.changes.push(path)
					}

					existing.transform = event.transform
				} else {
					eventsByUUID.set(uuid, entry)
				}
				break
		}
	}

	const processedEvents: ProcessMessage['events'] = []
	for (const entry of eventsByUUID.values()) {
		switch (entry?.changeType) {
			case TransformChangeType.ADDED:
				if (!entry.transform) continue
				processedEvents.push({
					changeType: TransformChangeType.ADDED,
					uuidString: entry.uuidString,
					transform: entry.transform,
				})
				break

			case TransformChangeType.REMOVED:
				processedEvents.push({
					changeType: TransformChangeType.REMOVED,
					uuidString: entry.uuidString,
				})
				break

			case TransformChangeType.UPDATED: {
				if (entry.changes.length === 0) continue

				processedEvents.push({
					changeType: TransformChangeType.UPDATED,
					uuidString: entry.uuidString,
					transform: entry.transform,
					changes: entry.changes,
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
