import type { Message, SuccessMessage } from './messages'

import { workerCode } from './worker.inline'

const blob = new Blob([workerCode], { type: 'text/javascript' })
const url = URL.createObjectURL(blob)
const worker = new Worker(url)

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

		const copy = new Uint8Array(data)
		worker.postMessage({ id, data: copy }, [copy.buffer])
	})
}
