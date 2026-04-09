import type { LODLevel, Message, SuccessMessage } from './messages'

import { workerCode } from './worker.inline'

const blob = new Blob([workerCode], { type: 'text/javascript' })
const url = URL.createObjectURL(blob)
const worker = new Worker(url)

export interface LODResult {
	levels: LODLevel[]
	boundingBoxDiagonal: number
}

let requestId = 0

type PendingEntry =
	| {
			mode: 'simple'
			resolve: (msg: SuccessMessage) => void
			reject: (err: string) => void
	  }
	| {
			mode: 'lod'
			resolve: (result: LODResult) => void
			reject: (err: string) => void
			onProgress?: (level: LODLevel) => void
			levels: LODLevel[]
			diagonal: number
	  }

const pending = new Map<number, PendingEntry>()

worker.addEventListener('message', (event: MessageEvent<Message>) => {
	const msg = event.data

	const entry = pending.get(msg.id)
	if (!entry) return

	if ('error' in msg) {
		pending.delete(msg.id)
		entry.reject(msg.error)
		return
	}

	if ('lod' in msg) {
		// Progressive LOD message
		if (entry.mode === 'lod') {
			entry.levels.push(msg.lod)
			entry.diagonal = msg.boundingBoxDiagonal
			entry.onProgress?.(msg.lod)

			if (msg.done) {
				pending.delete(msg.id)
				entry.resolve({
					levels: entry.levels.sort((a, b) => a.level - b.level),
					boundingBoxDiagonal: entry.diagonal,
				})
			}
		} else {
			// Simple mode receiving LOD messages — accumulate and resolve with finest level
			if (!('_levels' in entry)) {
				;(entry as PendingEntry & { _levels: LODLevel[] })._levels = []
			}
			const extended = entry as PendingEntry & { _levels: LODLevel[] }
			extended._levels.push(msg.lod)

			if (msg.done) {
				pending.delete(msg.id)
				const finest = extended._levels.find((l) => l.level === 0) ?? extended._levels[0]!
				entry.resolve({ id: msg.id, positions: finest.positions, colors: finest.colors })
			}
		}
		return
	}

	// Legacy single-message response (small cloud)
	pending.delete(msg.id)

	if (entry.mode === 'lod') {
		entry.resolve({
			levels: [{ level: 0, distance: 0, positions: msg.positions, colors: msg.colors }],
			boundingBoxDiagonal: 0,
		})
	} else {
		entry.resolve(msg as SuccessMessage)
	}
})

export const parsePcdInWorker = (data: Uint8Array<ArrayBufferLike>): Promise<SuccessMessage> => {
	return new Promise((resolve, reject) => {
		const id = ++requestId
		pending.set(id, { mode: 'simple', resolve, reject })

		const copy = new Uint8Array(data)
		worker.postMessage({ id, data: copy }, [copy.buffer])
	})
}

export const parsePcdWithLOD = (
	data: Uint8Array<ArrayBufferLike>,
	onProgress?: (level: LODLevel) => void
): Promise<LODResult> => {
	return new Promise((resolve, reject) => {
		const id = ++requestId
		pending.set(id, { mode: 'lod', resolve, reject, onProgress, levels: [], diagonal: 0 })

		const copy = new Uint8Array(data)
		worker.postMessage({ id, data: copy }, [copy.buffer])
	})
}
