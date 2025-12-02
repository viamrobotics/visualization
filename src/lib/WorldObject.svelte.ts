import type { Geometry, Pose, Struct, TransformWithUUID } from '@viamrobotics/sdk'
import { BatchedMesh, Color, MathUtils, Object3D, Vector3, type BufferGeometry } from 'three'
import { createPose, matrixToPose, poseToMatrix } from './transform'
import type { ValueOf } from 'type-fest'
import {
	isRGB,
	parseColor,
	parseOpacity,
	parseRGB,
	parseRGBABuffer,
	parseBase64RGBABuffer,
} from './color'
import type { OBB } from 'three/addons/math/OBB.js'
import type { Drawing, Shape } from './gen/draw/v1/drawing_pb'
import type { PlainMessage } from '@bufbuild/protobuf'
import { UuidTool } from 'uuid-tool'

// TODO: here for backwards compatibility, remove when moving to new draw API
export type LegacyPointsGeometry = {
	center: undefined
	geometryType: { case: 'legacyPoints'; value: Float32Array<ArrayBuffer> }
}

// TODO: here for backwards compatibility, remove when moving to new draw API
export type LegacyLinesGeometry = {
	center: undefined
	geometryType: { case: 'legacyLines'; value: Float32Array }
}

export type ThreeBufferGeometry = {
	center: undefined
	geometryType: { case: 'bufferGeometry'; value: BufferGeometry }
}

export type Geometries =
	| Geometry
	| PlainMessage<Shape>
	| LegacyPointsGeometry
	| LegacyLinesGeometry
	| ThreeBufferGeometry

export const SupportedShapes = {
	points: 'points',
	line: 'line',
	arrow: 'arrow',
} as const

const SUPPORTED_SHAPES_KEYS = Object.keys(SupportedShapes) as (keyof typeof SupportedShapes)[]

export interface ShapeMetadata {
	type: ValueOf<typeof SupportedShapes> | ''
}

export const COLOR_SCHEMA = ['r', 'g', 'b'] as const
export const POSE_SCHEMA = ['x', 'y', 'z', 'ox', 'oy', 'oz'] as const

export interface ArrowShapeMetadata extends ShapeMetadata {
	type: 'arrow'
	poseCount: number
	poses: Uint8Array
	colorCount: number
	colors: Uint8Array
}

export type Metadata = {
	colors?: Float32Array
	color?: Color
	opacity?: number
	gltf?: { scene: Object3D }
	points?: Vector3[]
	pointSize?: number
	lineWidth?: number
	lineDotColor?: Color
	batched?: {
		id: number
		object: BatchedMesh
	}
	shape?: ValueOf<typeof SupportedShapes>
	// TODO: Add other shape metadata types here
	shapeMetadata?: ArrowShapeMetadata
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
	'shapeMetadata',
] as const

const isMetadataKey = (key: string): key is keyof Metadata => {
	return METADATA_KEYS.includes(key as (typeof METADATA_KEYS)[number])
}

const isShapeMetadata = (value: unknown): value is ShapeMetadata => {
	return (
		typeof value === 'object' &&
		value !== null &&
		'type' in value &&
		SUPPORTED_SHAPES_KEYS.includes(value.type as (typeof SUPPORTED_SHAPES_KEYS)[number])
	)
}

const isArrowMetadata = (value: unknown): value is ArrowShapeMetadata => {
	if (!isShapeMetadata(value)) return false
	if (value.type !== 'arrow') return false
	if (!('poseCount' in value)) return false
	if (typeof value.poseCount !== 'number') return false
	if (!('poses' in value)) return false
	if (!(value.poses instanceof Uint8Array)) return false
	// Each pose is 6 float32 values (x, y, z, ox, oy, oz) = 6 * 4 bytes
	if (value.poses.length !== value.poseCount * POSE_SCHEMA.length * 4) return false
	if (!('colorCount' in value)) return false
	if (typeof value.colorCount !== 'number') return false
	if (!('colors' in value)) return false
	if (!(value.colors instanceof Uint8Array)) return false
	// Each color is 3 float32 values (r, g, b) = 3 * 4 bytes
	if (value.colors.length !== value.colorCount * COLOR_SCHEMA.length * 4) return false

	return true
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

const EMPTY_SHAPE_METADATA: ShapeMetadata = { type: '' }
const parseShapeMetadata = (value: unknown) => {
	if (!isShapeMetadata(value)) return EMPTY_SHAPE_METADATA
	switch (value.type) {
		case 'arrow':
			if ('poses' in value && typeof value.poses === 'string') {
				value.poses = Uint8Array.fromBase64(value.poses)
			}

			if ('colors' in value && typeof value.colors === 'string') {
				value.colors = Uint8Array.fromBase64(value.colors)
			}

			if (!isArrowMetadata(value)) return EMPTY_SHAPE_METADATA

			return value as ArrowShapeMetadata
		default:
			return EMPTY_SHAPE_METADATA
	}
}

const parseMetadata = (fields: PlainMessage<Struct>['fields'] = {}) => {
	const json: Metadata = {}

	for (const [k, v] of Object.entries(fields)) {
		if (!isMetadataKey(k)) continue
		const unwrappedValue = unwrapValue(v)

		switch (k) {
			case 'color':
			case 'lineDotColor':
				json[k] = isRGB(unwrappedValue) ? parseRGB(unwrappedValue) : parseColor(unwrappedValue)
				break
			case 'colors': {
				let colorsArray: Float32Array | undefined
				if (typeof unwrappedValue === 'string') {
					// Handle base64 encoded color data from JSON snapshots
					colorsArray = parseBase64RGBABuffer(unwrappedValue) as Float32Array
				} else if (unwrappedValue instanceof Uint8Array) {
					colorsArray = parseRGBABuffer(unwrappedValue) as Float32Array
				}
				if (colorsArray) {
					json[k] = colorsArray
					// Extract alpha/opacity from the 4th value if it exists
					if (colorsArray.length >= 4 && colorsArray[3] !== undefined) {
						json.opacity = colorsArray[3]
					}
				}
				break
			}
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
			case 'shapeMetadata':
				json[k] = parseShapeMetadata(unwrappedValue) as ArrowShapeMetadata
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
		transform.physicalObject,
		metadata
	)

	if (transform.uuidString) {
		worldObject.uuid = transform.uuidString
	}

	return worldObject
}

export type DrawingWithUUID = PlainMessage<Drawing> & { uuidString: string }
export const drawingWithUUID = (drawing: PlainMessage<Drawing>) => {
	return {
		...drawing,
		uuidString: UuidTool.toString([...drawing.uuid]),
	}
}

export const fromDrawing = (drawing: DrawingWithUUID) => {
	const colorsArray = parseRGBABuffer(drawing.metadata?.colors ?? new Uint8Array()) as Float32Array
	const metadata: Metadata = {
		colors: colorsArray,
	}

	if (colorsArray.length >= 4 && colorsArray[3] !== undefined) {
		metadata.opacity = colorsArray[3]
	}

	const worldObject = new WorldObject(
		drawing.referenceFrame,
		drawing.poseInObserverFrame?.pose,
		drawing.poseInObserverFrame?.referenceFrame,
		drawing.physicalObject,
		metadata
	)

	if (drawing.uuidString) {
		worldObject.uuid = drawing.uuidString
	}

	return worldObject
}

export const determinePose = (object: WorldObject, pose: Pose | undefined): Pose => {
	if (pose === undefined) {
		return object.localEditedPose
	} else {
		const poseNetwork = poseToMatrix(object.pose)
		const poseUsePose = poseToMatrix(pose)
		const poseLocalEditedPose = poseToMatrix(object.localEditedPose)

		const poseNetworkInverse = poseNetwork.invert()
		const resultMatrix = poseUsePose.multiply(poseNetworkInverse).multiply(poseLocalEditedPose)
		return matrixToPose(resultMatrix)
	}
}
