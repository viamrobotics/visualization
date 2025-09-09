import type { Geometry, Pose, TransformWithUUID } from '@viamrobotics/sdk'
import {
	BatchedMesh,
	Box3,
	Color,
	MathUtils,
	Object3D,
	Vector3,
	type ColorRepresentation,
	type RGB,
} from 'three'
import { createPose } from './transform'

export type PointsGeometry = { case: 'points'; value: Float32Array<ArrayBuffer> }
export type LinesGeometry = { case: 'line'; value: Float32Array }

export type Geometries = Geometry['geometryType'] | PointsGeometry | LinesGeometry

export type Metadata = {
	colors?: Float32Array
	color?: ColorRepresentation
	opacity?: number
	gltf?: { scene: Object3D }
	points?: Vector3[]
	pointSize?: number
	lineWidth?: number
	lineDotColor?: ColorRepresentation
	batched?: {
		id: number
		object: BatchedMesh
	}
	getBoundingBoxAt?: (box: Box3) => void
}

export class WorldObject<T extends Geometries = Geometries> {
	uuid: string
	name: string
	referenceFrame: string
	pose = $state.raw<Pose>(createPose())
	geometry?: T
	metadata: Metadata

	constructor(name: string, pose?: Pose, parent = 'world', geometry?: T, metadata?: Metadata) {
		this.uuid = MathUtils.generateUUID()
		this.name = name
		this.referenceFrame = parent

		this.geometry = geometry
		this.metadata = metadata ?? {}

		if (pose) {
			this.pose = pose
		}
	}
}

const unwrapValue = (value: any): any => {
	if (!value?.kind) return value

	switch (value.kind.case) {
		case 'numberValue':
		case 'stringValue':
		case 'boolValue':
			return value.kind.value
		case 'structValue':
			// Recursively unwrap nested struct
			const result: any = {}
			for (const [key, val] of Object.entries(value.kind.value.fields || {})) {
				result[key] = unwrapValue(val)
			}
			return result
		case 'listValue':
			return value.kind.value.values?.map(unwrapValue) || []
		case 'nullValue':
			return null
		default:
			return value.kind.value
	}
}

const parseMetadata = (metadata: any) => {
	let json: Metadata = {}

	for (const [k, v] of Object.entries(metadata)) {
		const unwrappedValue = unwrapValue(v)

		// TODO: Remove special case and add better handling for metadata
		if (k === 'color' && unwrappedValue && typeof unwrappedValue === 'object') {
			const { r, g, b }: RGB = unwrappedValue
			json[k] = new Color().setRGB(r / 255, g / 255, b / 255)
		} else {
			json = { ...json, [k]: unwrappedValue }
		}
	}

	return json
}

export const fromTransform = (transform: TransformWithUUID) => {
	const metadata: Metadata = transform.metadata ? parseMetadata(transform.metadata.fields) : {}
	const worldObject = new WorldObject(
		transform.referenceFrame,
		transform.poseInObserverFrame?.pose,
		transform.poseInObserverFrame?.referenceFrame,
		transform.physicalObject?.geometryType,
		metadata
	)
	worldObject.uuid = transform.uuidString
	return worldObject
}
