import type { Message, SuccessMessage } from './worker'
import { PCDLoader } from 'three/examples/jsm/loaders/PCDLoader.js'

const worker = new Worker(new URL('./worker', import.meta.url), { type: 'module' })

let requestId = 0
const pending = new Map<
	number,
	{
		resolve: (msg: SuccessMessage) => void
		reject: (err: string) => void
	}
>()

worker.addEventListener('message', (event: MessageEvent<Message>) => {
	const { id, ...rest } = event.data as Message

	const promise = pending.get(id)

	if (!promise) {
		return
	}

	pending.delete(id)

	if ('error' in rest) {
		promise.reject(rest.error)
	} else {
		promise.resolve(rest as SuccessMessage)
	}
})

export const parsePcdInWorker = (data: Uint8Array<ArrayBufferLike>): Promise<SuccessMessage> => {
	return new Promise((resolve, reject) => {
		const id = ++requestId
		pending.set(id, { resolve, reject })

		worker.postMessage({ id, data }, [data.buffer])
	})
}

export const parsePcd = (
	data: Uint8Array<ArrayBufferLike>
): { positions: Float32Array<ArrayBuffer>; colors: Uint8Array<ArrayBuffer> | null } => {
	const pcdLoader = new PCDLoader()
	const pcd = pcdLoader.parse(data.buffer as ArrayBuffer)
	if (pcd.geometry) {
		const positions =
			(pcd.geometry.attributes.position?.array as Float32Array<ArrayBuffer>) ?? new Float32Array(0)
		const colorsFloat: Float32Array | null =
			(pcd.geometry.attributes.color?.array as Float32Array<ArrayBuffer>) ?? null
		const colors = colorsFloat ? new Uint8Array(colorsFloat.length) : null

		if (colors) {
			for (let i = 0, l = colorsFloat.length; i < l; i++) {
				colors[i] = Math.round(colorsFloat[i] * 255)
			}
		}
		return { positions, colors }
	} else {
		throw new Error('Failed to parse PCD')
	}
}
