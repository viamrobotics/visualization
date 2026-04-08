export interface SuccessMessage {
	id: number
	positions: Float32Array
	colors: Uint8Array | undefined
}

export type Message =
	| SuccessMessage
	| {
			id: number
			error: string
	  }
