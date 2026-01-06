import { parsePcd } from './parser'

export interface SuccessMessage {
	id: number
	positions: Float32Array<ArrayBuffer>
	colors: Float32Array<ArrayBuffer> | null
}

export type Message =
	| SuccessMessage
	| {
			id: number
			error: string
	  }

self.onmessage = async (event) => {
	const { data, id } = event.data
	if (!(data instanceof Uint8Array)) {
		postMessage({ id, error: 'Invalid data format' } satisfies Message)
		return
	}

	try {
		const result = await parsePcd(data.buffer as ArrayBuffer)
		const positions = result.positions as Float32Array<ArrayBuffer>
		const colors = result.colors as Float32Array<ArrayBuffer> | null

		postMessage(
			{ positions, colors, id } satisfies Message,
			colors ? [positions.buffer, colors.buffer] : [positions.buffer]
		)
	} catch (error) {
		console.error(error)
		postMessage({ id, error: (error as Error).message } satisfies Message)
	}
}
