import type { ArmModelRendering } from './hooks/useSettings.svelte'
import { RenderArmModels } from './gen/draw/v1/scene_pb'
import { PassSnapshot } from './gen/draw/v1/snapshot_pb'
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

/** Decodes a PassSnapshot from JSON format, throws an error if the JSON is invalid or the snapshot is missing required fields.
 * @param json - The JSON object to decode.
 * @returns The decoded PassSnapshot.
 * @throws An error if the JSON is invalid or the snapshot is missing required fields.
 */
export const decodeSnapshotFromJSON = (json: unknown): PassSnapshot => {
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
	const transforms: PassSnapshot['transforms'] = data.transforms.map((transformJson: any) => {
		try {
			const parsed = Transform.fromJson(transformJson)
			return parsed
		} catch (error) {
			console.error('Failed to parse transform', error, transformJson)
			throw error
		}
	})

	const drawings: PassSnapshot['drawings'] = data.drawings.map((drawingJson: any) => {
		try {
			const parsed = Drawing.fromJson(drawingJson)
			return parsed
		} catch (error) {
			console.error('Failed to parse drawing', error, drawingJson)
			throw error
		}
	})

	return new PassSnapshot({
		transforms,
		drawings,
		sceneMetadata: data.sceneMetadata as PassSnapshot['sceneMetadata'] | undefined,
		uuid,
	})
}
