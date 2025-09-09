import type { ChangeMessage, ProcessMessage } from '$lib/world-state-messages'
import { getInUnsafe, toPath } from '@thi.ng/paths'
import { TransformChangeType } from '@viamrobotics/sdk'

self.onmessage = (e: MessageEvent<ChangeMessage>) => {
	const { events } = e.data
	const message: ProcessMessage = {
		type: 'process',
		events: [],
	}

	for (const event of events) {
		if (!event.transform) {
			continue
		}

		switch (event.changeType) {
			case TransformChangeType.ADDED:
				message.events.push({
					type: TransformChangeType.ADDED,
					uuidString: event.transform.uuidString,
					transform: event.transform,
				})
				break
			case TransformChangeType.REMOVED:
				message.events.push({
					type: TransformChangeType.REMOVED,
					uuidString: event.transform.uuidString,
				})
				break
			case TransformChangeType.UPDATED:
				const paths = toPath(event.updatedFields?.paths ?? [])
				const next: [path: string, value: unknown][] = []
				for (const path of paths) {
					next.push([path.toString(), getInUnsafe(event.transform, path)])
				}

				message.events.push({
					type: TransformChangeType.UPDATED,
					uuidString: event.transform.uuidString,
					changes: next,
				})
				break
		}
	}

	self.postMessage(message)
}

export {}
