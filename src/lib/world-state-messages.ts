import type { TransformChangeEvent, TransformWithUUID } from '@viamrobotics/sdk'

export type ChangeMessage = {
	type: 'change'
	events: TransformChangeEvent[]
}

export type TransformEvent = TransformChangeEvent & {
	transform: TransformWithUUID
}

export type ProcessMessage = {
	type: 'process'
	events: TransformEvent[]
}
