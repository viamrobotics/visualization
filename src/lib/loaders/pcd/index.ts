import type { Message, SuccessMessage } from './messages'

import { DEFAULT_SHUFFLE_DEPTH } from './messages'
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

/**
 * `shuffleDepth` is how many points the caller could ever draw decimated. Randomizing beyond it
 * is wasted work, and on a large cloud that waste is measured in hundreds of milliseconds.
 */
export const parsePcdInWorker = (
	data: Uint8Array,
	shuffleDepth: number = DEFAULT_SHUFFLE_DEPTH
): Promise<SuccessMessage> => {
	return new Promise((resolve, reject) => {
		const id = ++requestId
		pending.set(id, { resolve, reject })

		const copy = new Uint8Array(data)
		worker.postMessage({ id, data: copy, shuffleDepth }, [copy.buffer])
	})
}
