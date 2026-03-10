export interface SuccessMessage {
	id: number
	positions: Float32Array<ArrayBuffer>
	colors: Uint8Array<ArrayBuffer> | null
}

export type Message =
	| SuccessMessage
	| {
			id: number
			error: string
	  }
