import type { Geometry, PlainMessage, Pose, Struct, TransformWithUUID } from '@viamrobotics/sdk'
import { BatchedMesh, Color, MathUtils, Object3D, Vector3, type BufferGeometry } from 'three'
import type { GLTF } from 'three/examples/jsm/Addons.js'
import { createPose, matrixToPose, poseToMatrix } from './transform'
import type { ValueOf } from 'type-fest'
import { isColorRepresentation, isRGB, parseColor, parseOpacity, parseRGB } from './color'
import type { OBB } from 'three/addons/math/OBB.js'
import type { Entity } from 'koota'
import { traits } from './ecs'

export type PointsGeometry = {
	center: undefined
	geometryType: { case: 'points'; value: Float32Array<ArrayBuffer> }
}

export type LinesGeometry = {
	center: undefined
	geometryType: { case: 'line'; value: Float32Array }
}

export type ThreeBufferGeometry = {
	center: undefined
	geometryType: { case: 'bufferGeometry'; value: BufferGeometry }
}

export type Geometries = Geometry | PointsGeometry | LinesGeometry | ThreeBufferGeometry

export const SupportedShapes = {
	points: 'points',
	line: 'line',
	arrow: 'arrow',
} as const

export type Metadata = {
	colors?: Float32Array<ArrayBuffer>
	color?: Color
	opacity?: number
	gltf?: GLTF
	points?: Vector3[]
	pointSize?: number
	lineWidth?: number
	lineDotColor?: Color
	batched?: {
		id: number
		object: BatchedMesh
	}
	shape?: ValueOf<typeof SupportedShapes>
	getBoundingBoxAt?: (box: OBB) => void
}

const METADATA_KEYS = [
	'colors',
	'color',
	'opacity',
	'gltf',
	'points',
	'pointSize',
	'lineWidth',
	'lineDotColor',
	'batched',
	'shape',
] as const

export const isMetadataKey = (key: string): key is keyof Metadata => {
	return METADATA_KEYS.includes(key as (typeof METADATA_KEYS)[number])
}

export class WorldObject<T extends Geometries = Geometries> {
	uuid = MathUtils.generateUUID()
	name = ''
	referenceFrame = $state.raw<string>()
	pose = $state.raw<Pose>(createPose())
	geometry?: T = $state()
	metadata = $state<Metadata>({})
	localEditedPose = $state.raw<Pose>(createPose())

	constructor(name = '', pose?: Pose, parent = 'world', geometry?: T, metadata?: Metadata) {
		this.name = name
		this.referenceFrame = parent

		this.geometry = geometry
		if (metadata) {
			this.metadata = metadata
		}

		if (pose) {
			this.pose = pose
			this.localEditedPose = { ...pose }
		}
	}

	toJSON(): Omit<WorldObject, 'toJSON' | 'fromJSON' | 'metadata'> {
		return {
			uuid: this.uuid,
			name: this.name,
			referenceFrame: $state.snapshot(this.referenceFrame),
			pose: $state.snapshot(this.pose),
			geometry: $state.snapshot(this.geometry) as Geometry,
			localEditedPose: $state.snapshot(this.localEditedPose),
		}
	}

	fromJSON(json: WorldObject) {
		this.uuid = json.uuid
		this.name = json.name
		this.referenceFrame = json.referenceFrame
		this.pose = json.pose
		this.geometry = json.geometry as T
		this.localEditedPose = json.localEditedPose
		this.metadata = {}

		return this
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
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
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

export const parseMetadata = (fields: PlainMessage<Struct>['fields'] = {}) => {
	const json: Metadata = {}

	for (const [k, v] of Object.entries(fields)) {
		if (!isMetadataKey(k)) continue
		const unwrappedValue = unwrapValue(v)

		switch (k) {
			case 'color':
			case 'lineDotColor':
				json[k] = readColor(unwrappedValue)
				break
			case 'opacity':
				json[k] = parseOpacity(unwrappedValue)
				break
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
			case 'batched':
				json[k] = unwrappedValue as { id: number; object: BatchedMesh }
				break
			case 'shape':
				json[k] = unwrappedValue as ValueOf<typeof SupportedShapes>
				break
		}
	}

	return json
}

const readColor = (color: unknown): Color => {
	if (isColorRepresentation(color)) return parseColor(color)
	if (isRGB(color)) return parseRGB(color)
	return new Color('black')
}

export const fromTransform = (transform: TransformWithUUID) => {
	const metadata: Metadata = transform.metadata ? parseMetadata(transform.metadata.fields) : {}

	const worldObject = new WorldObject(
		transform.referenceFrame,
		transform.poseInObserverFrame?.pose,
		transform.poseInObserverFrame?.referenceFrame,
		transform.physicalObject,
		metadata
	)
	worldObject.uuid = transform.uuidString
	return worldObject
}

export const determinePose = (entity: Entity, pose: Pose | undefined): Pose | undefined => {
	if (pose === undefined) {
		return entity.get(traits.EditedPose)
	} else {
		const entityPose = entity.get(traits.Pose)
		const editedPose = entity.get(traits.EditedPose)

		if (!entityPose || !editedPose) {
			return
		}

		const poseNetwork = poseToMatrix(entityPose)
		const poseUsePose = poseToMatrix(pose)
		const poseLocalEditedPose = poseToMatrix(editedPose)

		const poseNetworkInverse = poseNetwork.invert()
		const resultMatrix = poseUsePose.multiply(poseNetworkInverse).multiply(poseLocalEditedPose)
		return matrixToPose(resultMatrix)
	}
}
