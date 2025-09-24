import {
	postProcessMessage,
	type ChangeMessage,
	type ProcessMessage,
} from '$lib/world-state-messages'
import { getInUnsafe, setInUnsafe, toPath } from '@thi.ng/paths'
import {
	TransformChangeType,
	type TransformChangeEvent,
	type TransformWithUUID,
} from '@viamrobotics/sdk'

interface DeduplicationEntry {
	type: TransformChangeType
	uuidString: string
	transform?: TransformWithUUID
	changes?: Set<readonly (number | string)[]>
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
			const paths = event.updatedFields?.paths ?? []
			return {
				type: event.changeType,
				uuidString: event.transform.uuidString,
				transform: event.transform,
				changes: new Set(paths.map(toPath)),
			}
		}
	}
}

// Throttle worker output to prevent overwhelming the main thread
let workerLastPostTime = 0
const WORKER_THROTTLE_MS = 200 // Only post every 200ms max - more aggressive throttling

self.onmessage = (e: MessageEvent<ChangeMessage>) => {
	const { events } = e.data
	if (events.length === 0) return

	// Limit the number of events the worker processes at once to prevent it from being overwhelmed
	const maxWorkerEvents = 50 // Reduced from 100
	const limitedEvents = events.slice(0, maxWorkerEvents)

	const eventsByUUID = new Map<string, DeduplicationEntry>()

	for (const event of limitedEvents) {
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
					const paths = event.updatedFields?.paths ?? []
					if (paths.length === 0) continue
					for (const path of paths) {
						const parsed = toPath(path)
						const next = getInUnsafe(entry.transform, parsed)
						existing.changes ??= new Set()
						existing.changes.add(parsed)
						existing.transform = setInUnsafe(existing.transform, parsed, next)
					}
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
				if (!entry.transform) continue

				const changes = Array.from(entry.changes ?? [])
				if (changes.length === 0) continue

				processedEvents.push({
					type: TransformChangeType.UPDATED,
					uuidString: entry.uuidString,
					transform: entry.transform,
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

	// Throttle worker output to prevent overwhelming the main thread
	const now = performance.now()
	if (now - workerLastPostTime >= WORKER_THROTTLE_MS) {
		postProcessMessage(self, message)
		workerLastPostTime = now
	}
}

export {}
