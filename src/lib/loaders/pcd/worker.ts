import { PCDLoader } from 'three/examples/jsm/loaders/PCDLoader.js'

const loader = new PCDLoader()

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
		const pcd = loader.parse(data.buffer as ArrayBuffer)
		if (pcd.geometry) {
			const positions = pcd.geometry.attributes.position.array as Float32Array<ArrayBuffer>
			const colors = (pcd.geometry.attributes.color?.array as Float32Array<ArrayBuffer>) ?? null

			postMessage(
				{ positions, colors, id } satisfies Message,
				colors ? [positions.buffer, colors.buffer] : [positions.buffer]
			)
		} else {
			postMessage({ id, error: 'Failed to extract geometry' } satisfies Message)
		}
	} catch (error) {
		postMessage({ id, error: (error as Error).message } satisfies Message)
	}
}
