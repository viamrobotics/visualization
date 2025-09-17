import type { Message, SuccessMessage } from './worker'
import PCDWorker from './worker?worker'

const worker = new PCDWorker()

export const parsePcdInWorker = async (
	data: Uint8Array<ArrayBufferLike>
): Promise<SuccessMessage> => {
	return new Promise((resolve, reject) => {
		const onMessage = (event: MessageEvent<Message>) => {
			worker.removeEventListener('message', onMessage)

			if ('error' in event.data) {
				return reject(event.data.error)
			}

			resolve(event.data)
		}

		worker.addEventListener('message', onMessage)
		worker.postMessage({ data }, [data.buffer])
	})
}
