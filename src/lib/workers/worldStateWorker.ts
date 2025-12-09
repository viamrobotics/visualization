import type { ChangeMessage, ProcessMessage, TransformEvent } from '$lib/world-state-messages'
import { TransformChangeType } from '@viamrobotics/sdk'

self.onmessage = (e: MessageEvent<ChangeMessage>) => {
	const { events } = e.data
	if (events.length === 0) return

	const eventsByUUID = new Map<string, TransformEvent>()

	for (const event of events) {
		if (!event.transform) {
			continue
		}

		const uuid = event.transform.uuidString
		const existing = eventsByUUID.get(uuid)
		if (!existing) {
			eventsByUUID.set(uuid, event as TransformEvent)
			continue
		}

		switch (event.changeType) {
			case TransformChangeType.REMOVED:
				eventsByUUID.set(uuid, event as TransformEvent)
				break

			case TransformChangeType.ADDED:
				if (existing.changeType !== TransformChangeType.REMOVED) {
					eventsByUUID.set(uuid, event as TransformEvent)
				}
				break

			case TransformChangeType.UPDATED:
				// merge with existing updated event
				if (existing.changeType === TransformChangeType.UPDATED) {
					existing.updatedFields ??= { paths: [] }

					const paths = event.updatedFields?.paths ?? []

					for (const path of paths) {
						if (existing.updatedFields.paths.includes(path)) {
							continue
						}

						existing.updatedFields.paths.push(path)
					}

					existing.transform = event.transform
				} else {
					eventsByUUID.set(uuid, event as TransformEvent)
				}
				break
		}
	}

	const message: ProcessMessage = {
		type: 'process',
		events: [...eventsByUUID.values()],
	}

	self.postMessage(message)
}

export {}
