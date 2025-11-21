import { Transform, Vector3 } from '@viamrobotics/sdk'

export interface PerspectiveCamera {}
export interface OrthographicCamera {}

export interface SceneCamera {
	position?: Vector3 // defaults to [3, 3, 3] (in mm)
	lookAt?: Vector3 // defaults to [0, 0, 0]
	perspectiveCamera?: PerspectiveCamera // default
	orthographicCamera?: OrthographicCamera
}

export enum RenderArmModels {
	UNSPECIFIED = 0,
	COLLIDERS = 1,
	COLLIDERS_AND_MODEL = 2,
	MODEL = 3,
}

export interface SceneMetadata {
	sceneCamera?: SceneCamera
	grid?: boolean // defaults to true
	gridCellSize?: number // defaults to 0.5
	gridSectionSize?: number // defaults to 10
	gridFadeDistance?: number // defaults to 25
	pointSize?: number // defaults to 0.01
	pointColor?: string // defaults to #333333
	lineWidth?: number // defaults to 0.005
	lineDotSize?: number // defaults to 0.01
	renderArmModels?: RenderArmModels // defaults to COLLIDERS_AND_MODEL
}

export interface PassSnapshot {
	transforms: Transform[]
	sceneMetadata?: SceneMetadata
	uuid: Uint8Array
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

	if (!data.uuid || typeof data.uuid !== 'string') {
		throw new Error('Invalid snapshot: missing or invalid UUID')
	}

	const uuid = Uint8Array.fromBase64(data.uuid)
	const transforms = data.transforms.map((transformJson: any) => {
		try {
			const parsed = Transform.fromJson(transformJson)
			return parsed
		} catch (error) {
			console.error('Failed to parse transform', error, transformJson)
			throw error
		}
	})

	return {
		transforms,
		sceneMetadata: data.sceneMetadata as SceneMetadata | undefined,
		uuid,
	}
}
