import { WasmPCDProcessor, DELTA_FORMATS } from '$lib/wasm/pcd-processor'
import type { Metadata } from '$lib/WorldObject.svelte'

// Message types for pointcloud worker communication
export interface PointCloudLoadMessage {
	type: 'load'
	uuid: string
	data: Uint8Array
	metadata?: Metadata
}

export interface PointCloudUpdateMessage {
	type: 'update'
	uuid: string
	deltaData: Uint8Array
	format: string
	existingPositions?: Float32Array
	existingColors?: Float32Array
	metadata?: Metadata
}

export interface PointCloudDisposeMessage {
	type: 'dispose'
	uuid: string
}

export type PointcloudWorkerMessage =
	| PointCloudLoadMessage
	| PointCloudUpdateMessage
	| PointCloudDisposeMessage

// Response types
export interface PointCloudLoadedResponse {
	type: 'loaded'
	uuid: string
	positions: Float32Array
	colors: Float32Array | null
	pointCount: number
}

export interface PointCloudUpdatedResponse {
	type: 'updated'
	uuid: string
	updatedIndices: number[]
	positions: Float32Array
	colors: Float32Array | null
	pointCount: number
	updatedInPlace?: boolean
}

export interface PointCloudErrorResponse {
	type: 'error'
	uuid: string
	error: string
}

export interface PointCloudDisposedResponse {
	type: 'disposed'
	uuid: string
}

export type PointCloudWorkerResponse =
	| PointCloudLoadedResponse
	| PointCloudUpdatedResponse
	| PointCloudErrorResponse
	| PointCloudDisposedResponse

class PointCloudWorker {
	private processors = new Map<string, WasmPCDProcessor>()

	async handleMessage(message: PointcloudWorkerMessage): Promise<PointCloudWorkerResponse> {
		try {
			switch (message.type) {
				case 'load':
					return await this.loadPointcloud(message)
				case 'update':
					return await this.updatePointcloud(message)
				case 'dispose':
					return this.disposePointcloud(message)
				default:
					throw new Error(`Unknown message type: ${(message as any).type}`)
			}
		} catch (error) {
			return {
				type: 'error',
				uuid: message.uuid,
				error: error instanceof Error ? error.message : String(error),
			}
		}
	}

	private async loadPointcloud(message: PointCloudLoadMessage): Promise<PointCloudWorkerResponse> {
		const { uuid, data, metadata } = message

		const processor = new WasmPCDProcessor()
		await processor.initialize()

		const result = await processor.parsePCD(data, metadata)
		this.processors.set(uuid, processor)
		return {
			type: 'loaded',
			uuid,
			positions: result.positions,
			colors: result.colors,
			pointCount: result.pointCount,
		}
	}

	private async updatePointcloud(
		message: PointCloudUpdateMessage
	): Promise<PointCloudWorkerResponse> {
		const { uuid, deltaData, format, existingPositions, existingColors, metadata } = message

		const processor = this.processors.get(uuid)
		if (!processor) {
			throw new Error(`No processor found for UUID: ${uuid}`)
		}

		if (format !== DELTA_FORMATS.INDEX_X_Y_Z) {
			throw new Error(`Unsupported delta format: ${format}`)
		}

		// always true for now, could introduce format with color
		const result = await processor.applyDelta(
			deltaData,
			existingPositions,
			existingColors,
			metadata
		)

		return {
			type: 'updated',
			uuid,
			updatedIndices: result.updatedIndices,
			positions: result.positions,
			colors: result.colors,
			pointCount: result.pointCount,
			updatedInPlace: result.updatedInPlace,
		}
	}

	private disposePointcloud(message: PointCloudDisposeMessage): PointCloudWorkerResponse {
		const { uuid } = message
		this.processors.delete(uuid)

		return {
			type: 'disposed',
			uuid,
		}
	}
}

const worker = new PointCloudWorker()

// Message handler
self.onmessage = async (event: MessageEvent<PointcloudWorkerMessage>) => {
	try {
		const response = await worker.handleMessage(event.data)

		// Extract transferable objects for efficient communication
		const transferables: Transferable[] = []
		if ('positions' in response && response.positions) {
			transferables.push(response.positions.buffer)
		}
		if ('colors' in response && response.colors) {
			transferables.push(response.colors.buffer)
		}

		if (transferables.length > 0) {
			;(self as any).postMessage(response, { transfer: transferables })
		} else {
			self.postMessage(response)
		}
	} catch (error) {
		self.postMessage({
			type: 'error',
			uuid: event.data?.uuid || 'unknown',
			error: error instanceof Error ? error.message : String(error),
		} satisfies PointCloudErrorResponse)
	}
}

export {}
