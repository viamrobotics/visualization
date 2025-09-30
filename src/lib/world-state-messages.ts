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
	changes: [path: readonly (string | number)[], value: any][]
}

export type ProcessMessage = {
	type: 'process'
	events: (AddedEvent | RemovedEvent | UpdatedEvent)[]
}
