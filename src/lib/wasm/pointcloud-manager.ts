import PointcloudWorker from '$lib/workers/pointcloudWorker?worker'
import type {
	PointcloudWorkerMessage,
	PointCloudWorkerResponse,
} from '$lib/workers/pointcloudWorker'
import type { Metadata } from '$lib/WorldObject.svelte'

export interface PointCloudLoadResult {
	positions: Float32Array
	colors: Float32Array | null
	pointCount: number
}

export interface PointCloudUpdateResult {
	updatedIndices: number[]
	positions: Float32Array
	colors: Float32Array | null
	pointCount: number
	updatedInPlace?: boolean
}

export class PointCloudManager {
	private worker: Worker
	private pendingRequests = new Map<
		string,
		{
			resolve: (value: any) => void
			reject: (error: Error) => void
		}
	>()

	constructor() {
		this.worker = new PointcloudWorker()
		this.worker.onmessage = this.handleWorkerMessage.bind(this)
		this.worker.onerror = this.handleWorkerError.bind(this)
	}

	private handleWorkerMessage(event: MessageEvent<PointCloudWorkerResponse>) {
		const { uuid, type } = event.data
		const pending = this.pendingRequests.get(uuid)

		if (!pending) {
			console.warn(`No pending request found for UUID: ${uuid}`)
			return
		}

		this.pendingRequests.delete(uuid)

		if (type === 'error') {
			pending.reject(new Error(event.data.error))
			return
		}

		switch (type) {
			case 'loaded':
				pending.resolve({
					positions: event.data.positions,
					colors: event.data.colors,
					pointCount: event.data.pointCount,
				} satisfies PointCloudLoadResult)
				break

			case 'updated':
				pending.resolve({
					updatedIndices: event.data.updatedIndices,
					positions: event.data.positions,
					colors: event.data.colors,
					pointCount: event.data.pointCount,
				} satisfies PointCloudUpdateResult)
				break

			case 'disposed':
				pending.resolve(undefined)
				break

			default:
				pending.reject(new Error(`Unknown response type: ${type}`))
		}
	}

	private handleWorkerError(error: ErrorEvent) {
		console.error('Pointcloud worker error:', error)

		// Reject all pending requests
		for (const [uuid, pending] of this.pendingRequests) {
			pending.reject(new Error(`Worker error: ${error.message}`))
		}
		this.pendingRequests.clear()
	}

	async loadPointcloud(
		uuid: string,
		data: Uint8Array,
		metadata?: Metadata
	): Promise<PointCloudLoadResult> {
		return new Promise((resolve, reject) => {
			this.pendingRequests.set(uuid, { resolve, reject })

			const message: PointcloudWorkerMessage = {
				type: 'load',
				uuid,
				data,
				metadata,
			}

			this.worker.postMessage(message, [data.buffer])
		})
	}

	async updatePointcloud(
		uuid: string,
		deltaData: Uint8Array,
		format: string = 'index_x_y_z',
		existingPositions?: Float32Array,
		existingColors?: Float32Array,
		metadata?: Metadata
	): Promise<PointCloudUpdateResult> {
		return new Promise((resolve, reject) => {
			this.pendingRequests.set(uuid, { resolve, reject })

			const message: PointcloudWorkerMessage = {
				type: 'update',
				uuid,
				deltaData,
				format,
				existingPositions,
				existingColors,
				metadata,
			}

			// Don't transfer existing arrays as they may be detached from previous transfers
			// Only transfer the delta data which is always new
			const transferables = [deltaData.buffer]

			this.worker.postMessage(message, transferables)
		})
	}

	async disposePointcloud(uuid: string): Promise<void> {
		return new Promise((resolve, reject) => {
			this.pendingRequests.set(uuid, { resolve, reject })

			const message: PointcloudWorkerMessage = {
				type: 'dispose',
				uuid,
			}

			this.worker.postMessage(message)
		})
	}

	terminate() {
		// Reject all pending requests
		for (const [uuid, pending] of this.pendingRequests) {
			pending.reject(new Error('Worker terminated'))
		}
		this.pendingRequests.clear()

		this.worker.terminate()
	}
}

// Global manager instance
let globalManager: PointCloudManager | null = null

export const getPointcloudManager = (): PointCloudManager => {
	if (!globalManager) {
		globalManager = new PointCloudManager()
	}
	return globalManager
}
