import {
	TransformChangeType,
	type TransformChangeEvent,
	type TransformWithUUID,
} from '@viamrobotics/sdk'

export type ChangeMessage = {
	type: 'change'
	events: TransformChangeEvent[]
}

export type AddedEvent = {
	type: TransformChangeType.ADDED
	uuidString: string
	transform: TransformWithUUID
}

export type RemovedEvent = {
	type: TransformChangeType.REMOVED
	uuidString: string
}

export type UpdatedEvent = {
	type: TransformChangeType.UPDATED
	uuidString: string
	changes: [path: string, value: unknown][]
}

export type ProcessMessage = {
	type: 'process'
	events: (AddedEvent | RemovedEvent | UpdatedEvent)[]
}
