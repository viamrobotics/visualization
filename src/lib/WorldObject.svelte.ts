import type { Geometry, PlainMessage, Pose, Struct, TransformWithUUID } from '@viamrobotics/sdk'
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
import type { SuccessMessage } from './loaders/pcd/worker'

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

const METADATA_KEYS = [
	'color',
	'opacity',
	'gltf',
	'points',
	'pointSize',
	'lineWidth',
	'lineDotColor',
	'batched',
] as const

export const isMetadataKey = (key: string): key is keyof Metadata => {
	return METADATA_KEYS.includes(key as (typeof METADATA_KEYS)[number])
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const unwrapValue = (value: PlainMessage<any>): unknown => {
	if (!value?.kind) return value

	switch (value.kind.case) {
		case 'numberValue':
		case 'stringValue':
		case 'boolValue':
			return value.kind.value
		case 'structValue': {
			const result: Record<string, unknown> = {}
			for (const [key, val] of Object.entries(value.kind.value.fields || {})) {
				result[key] = unwrapValue(val as PlainMessage<any>)
			}
			return result
		}
		case 'listValue':
			return value.kind.value.values?.map(unwrapValue) || []
		case 'nullValue':
			return null
		default:
			return value.kind.value
	}
}

const parseMetadata = (fields: PlainMessage<Struct>['fields']) => {
	let json: Metadata = {}

	for (const [k, v] of Object.entries(fields)) {
		if (!isMetadataKey(k)) continue
		const unwrappedValue = unwrapValue(v)

		switch (k) {
			case 'color': {
				const raw = unwrappedValue as RGB
				const r = raw.r > 1 ? raw.r / 255 : raw.r
				const g = raw.g > 1 ? raw.g / 255 : raw.g
				const b = raw.b > 1 ? raw.b / 255 : raw.b
				json[k] = new Color().setRGB(r, g, b)
				break
			}
			case 'opacity': {
				const rawOpacity = unwrappedValue as number
				const opacity = rawOpacity > 1 ? rawOpacity / 100 : rawOpacity
				json[k] = opacity
				break
			}
			case 'gltf':
				json[k] = unwrappedValue as { scene: Object3D }
				break
			case 'points':
				json[k] = unwrappedValue as Vector3[]
				break
			case 'pointSize':
				json[k] = unwrappedValue as number
				break
			case 'lineWidth':
				json[k] = unwrappedValue as number
				break
			case 'lineDotColor': {
				const rawLineDotColor = unwrappedValue as RGB
				const r = rawLineDotColor.r > 1 ? rawLineDotColor.r / 255 : rawLineDotColor.r
				const g = rawLineDotColor.g > 1 ? rawLineDotColor.g / 255 : rawLineDotColor.g
				const b = rawLineDotColor.b > 1 ? rawLineDotColor.b / 255 : rawLineDotColor.b
				json[k] = new Color().setRGB(r, g, b)
				break
			}
			case 'batched':
				json[k] = unwrappedValue as { id: number; object: BatchedMesh }
				break
			case 'getBoundingBoxAt':
				json[k] = unwrappedValue as (box: Box3) => void
				break
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

export type PointcloudTransform = TransformWithUUID & SuccessMessage
export const fromPointcloudTransform = (pointcloud: PointcloudTransform) => {
	const metadata: Metadata = pointcloud.metadata ? parseMetadata(pointcloud.metadata.fields) : {}
	return new WorldObject(
		pointcloud.referenceFrame,
		pointcloud.poseInObserverFrame?.pose,
		pointcloud.poseInObserverFrame?.referenceFrame,
		{ case: 'points', value: pointcloud.positions },
		{
			...metadata,
			colors: pointcloud.colors ?? undefined,
		}
	)
}
