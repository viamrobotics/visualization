import type { ArmModelRendering } from './hooks/useSettings.svelte'
import { RenderArmModels } from './gen/draw/v1/scene_pb'
import { Snapshot } from './gen/draw/v1/snapshot_pb'
import { Drawing } from './gen/draw/v1/drawing_pb'
import { Transform } from './gen/common/v1/common_pb'

export const getArmModelRendering = (model: RenderArmModels): ArmModelRendering => {
	switch (model) {
		case RenderArmModels.COLLIDERS:
			return 'colliders'
		case RenderArmModels.COLLIDERS_AND_MODEL:
			return 'colliders+model'
		case RenderArmModels.MODEL:
			return 'model'
		default:
			return 'colliders+model'
	}
}

/** Decodes a Snapshot from JSON format, throws an error if the JSON is invalid or the snapshot is missing required fields.
 * @param json - The JSON object to decode.
 * @returns The decoded Snapshot.
 * @throws An error if the JSON is invalid or the snapshot is missing required fields.
 */
export const decodeSnapshotFromJSON = (json: unknown): Snapshot => {
	if (!json || typeof json !== 'object') {
		throw new Error('Invalid JSON: expected an object')
	}

	const data = json as Record<string, unknown>
	if (!data.transforms || !Array.isArray(data.transforms)) {
		throw new Error('Invalid snapshot: missing transforms array')
	}

	if (!data.drawings || !Array.isArray(data.drawings)) {
		throw new Error('Invalid snapshot: missing drawings array')
	}

	if (!data.uuid || typeof data.uuid !== 'string') {
		throw new Error('Invalid snapshot: missing or invalid UUID')
	}

	if (!data.sceneMetadata || typeof data.sceneMetadata !== 'object') {
		throw new Error('Invalid snapshot: missing or invalid scene metadata')
	}

	const uuid = Uint8Array.fromBase64(data.uuid)
	const transforms: Snapshot['transforms'] = data.transforms.map((transformJson: any) => {
		try {
			const parsed = Transform.fromJson(transformJson)
			return parsed
		} catch (error) {
			console.error('Failed to parse transform', error, transformJson)
			throw error
		}
	})

	const drawings: Snapshot['drawings'] = data.drawings.map((drawingJson: any) => {
		try {
			const parsed = Drawing.fromJson(drawingJson)
			return parsed
		} catch (error) {
			console.error('Failed to parse drawing', error, drawingJson)
			throw error
		}
	})

	return new Snapshot({
		transforms,
		drawings,
		sceneMetadata: data.sceneMetadata as Snapshot['sceneMetadata'] | undefined,
		uuid,
	})
}

/** Decodes a Snapshot from binary protobuf format.
 * @param bytes - The binary protobuf data as Uint8Array.
 * @returns The decoded Snapshot.
 * @throws An error if the binary data is invalid.
 */
export const decodeSnapshotFromBinary = (bytes: Uint8Array): Snapshot => {
	return Snapshot.fromBinary(bytes)
}

/** Decodes a Snapshot from gzip-compressed binary protobuf format.
 * Uses the DecompressionStream API available in modern browsers.
 * @param compressed - The gzip-compressed binary data as Uint8Array.
 * @returns A Promise that resolves to the decoded Snapshot.
 * @throws An error if decompression or decoding fails.
 */
export const decodeSnapshotFromGzip = async (compressed: Uint8Array): Promise<Snapshot> => {
	const ds = new DecompressionStream('gzip')
	const blob = new Blob([compressed.buffer as ArrayBuffer])
	const decompressedStream = blob.stream().pipeThrough(ds)
	const decompressedBlob = await new Response(decompressedStream).blob()
	const decompressedBuffer = await decompressedBlob.arrayBuffer()
	const decompressedBytes = new Uint8Array(decompressedBuffer)
	return decodeSnapshotFromBinary(decompressedBytes)
}
