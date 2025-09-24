import type { Message, SuccessMessage } from './worker'
import PCDWorker from './worker?worker'

const worker = new PCDWorker()

let requestId = 0
const pending = new Map<
	number,
	{
		resolve: (msg: SuccessMessage) => void
		reject: (err: any) => void
	}
>()

worker.addEventListener('message', (event: MessageEvent<Message>) => {
	const { id, ...rest } = event.data as any

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
