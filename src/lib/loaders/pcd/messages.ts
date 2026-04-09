export interface SuccessMessage {
	id: number
	positions: Float32Array<ArrayBuffer>
	colors: Uint8Array<ArrayBuffer> | null
}

export interface LODLevel {
	level: number
	distance: number
	positions: Float32Array<ArrayBuffer>
	colors: Uint8Array<ArrayBuffer> | null
}

export interface LODProgressMessage {
	id: number
	lod: LODLevel
	done: boolean
	boundingBoxDiagonal: number
}

export type Message =
	| SuccessMessage
	| LODProgressMessage
	| {
			id: number
			error: string
	  }
