export interface SuccessMessage {
	id: number
	positions: Float32Array
	colors: Uint8Array | null
}

export type Message =
	| SuccessMessage
	| {
			id: number
			error: string
	  }
