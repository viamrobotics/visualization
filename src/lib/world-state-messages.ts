import {
	Geometry,
	TransformChangeType,
	type TransformChangeEvent,
	type TransformWithUUID,
} from '@viamrobotics/sdk'

export type ChangeMessage = {
	type: 'change'
	events: TransformChangeEvent[]
}

export type AddedEvent = {
	type: TransformChangeType.ADDED
	uuidString: string
	transform: TransformWithUUID
}

export type RemovedEvent = {
	type: TransformChangeType.REMOVED
	uuidString: string
}

export type UpdatedEvent = {
	type: TransformChangeType.UPDATED
	uuidString: string
	transform: TransformWithUUID
	changes: (readonly (number | string)[])[]
}

export type ProcessMessage = {
	type: 'process'
	events: (AddedEvent | RemovedEvent | UpdatedEvent)[]
}

const extractGeometryBuffers = (
	geometry: Geometry['geometryType'],
	buffers: ArrayBufferLike[] = []
): ArrayBufferLike[] => {
	if (!geometry) return buffers
	switch (geometry.case) {
		case 'mesh': {
			// Mesh data is stored as Uint8Array (PLY format binary data)
			const meshData = geometry.value.mesh
			if (meshData instanceof Uint8Array) {
				buffers.push(meshData.buffer)
			}
			break
		}
		case 'pointcloud': {
			// Point cloud data is stored as Uint8Array (binary point cloud data)
			const pointCloudData = geometry.value.pointCloud
			if (pointCloudData instanceof Uint8Array) {
				buffers.push(pointCloudData.buffer)
			}
			break
		}
		default:
			// sphere, box, capsule cases contain only numeric data (no ArrayBuffers)
			break
	}

	return buffers
}

const extractTransformBuffers = (
	transform: TransformWithUUID,
	buffers: ArrayBufferLike[] = []
): ArrayBufferLike[] => {
	// uuid is a Uint8Array
	buffers.push(transform.uuid.buffer)
	if (transform.physicalObject?.geometryType) {
		extractGeometryBuffers(transform.physicalObject.geometryType, buffers)
	}

	return buffers
}

const extractChangeMessageBuffers = (message: ChangeMessage): ArrayBuffer[] => {
	const buffers: ArrayBuffer[] = []
	for (const event of message.events) {
		if (event.transform) {
			extractTransformBuffers(event.transform, buffers)
		}
	}

	return Array.from(new Set(buffers))
}

const extractProcessMessageBuffers = (message: ProcessMessage): ArrayBuffer[] => {
	const buffers: ArrayBuffer[] = []
	for (const event of message.events) {
		if ('transform' in event && event.transform) {
			extractTransformBuffers(event.transform, buffers)
		}
	}

	return Array.from(new Set(buffers))
}

export const getChangeMessageTransferables = (
	message: ChangeMessage
): ArrayBuffer[] | undefined => {
	const buffers = extractChangeMessageBuffers(message)
	return buffers.length > 0 ? buffers : undefined
}

export const getProcessMessageTransferables = (
	message: ProcessMessage
): ArrayBuffer[] | undefined => {
	const buffers = extractProcessMessageBuffers(message)
	return buffers.length > 0 ? buffers : undefined
}

/** Post a ChangeMessage from a main thread to a worker **/
export const postChangeMessage = (worker: Worker, message: ChangeMessage): void => {
	const transferables = getChangeMessageTransferables(message)
	if (transferables) {
		worker.postMessage(message, transferables)
		return
	}

	worker.postMessage(message)
}

/** Post a ProcessMessage from a worker to a main thread */
export const postProcessMessage = (
	worker: Window & typeof globalThis,
	message: ProcessMessage
): void => {
	const transferables = getProcessMessageTransferables(message)
	if (transferables) {
		worker.postMessage(message, transferables)
		return
	}

	worker.postMessage(message)
}
