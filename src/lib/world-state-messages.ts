import type {
	TransformChangeEvent,
	TransformChangeType,
	TransformWithUUID,
} from '@viamrobotics/sdk'

export type ChangeMessage = {
	type: 'change'
	events: TransformChangeEvent[]
}

export type AddedEvent = {
	changeType: TransformChangeType.ADDED
	uuidString: string
	transform: TransformWithUUID
}

export type RemovedEvent = {
	changeType: TransformChangeType.REMOVED
	uuidString: string
}

export type UpdatedEvent = {
	changeType: TransformChangeType.UPDATED
	uuidString: string
	transform: TransformWithUUID
	changes: (number | string)[]
}

export type ProcessMessage = {
	type: 'process'
	events: (AddedEvent | RemovedEvent | UpdatedEvent)[]
}
