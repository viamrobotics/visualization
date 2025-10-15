import type { Geometry, PlainMessage, Pose, Struct, TransformWithUUID } from '@viamrobotics/sdk'
import { BatchedMesh, Color, MathUtils, Matrix4, Object3D, Quaternion, Vector3 } from 'three'
import { createPose } from './transform'
import type { ValueOf } from 'type-fest'
import { isColorRepresentation, isRGB, parseColor, parseOpacity, parseRGB } from './color'
import type { OBB } from 'three/addons/math/OBB.js'

export type PointsGeometry = {
	center: undefined
	geometryType: { case: 'points'; value: Float32Array<ArrayBuffer> }
}

export type LinesGeometry = {
	center: undefined
	geometryType: { case: 'line'; value: Float32Array }
}

export type Geometries = Geometry | PointsGeometry | LinesGeometry

export const SupportedShapes = {
	points: 'points',
	line: 'line',
	arrow: 'arrow',
} as const

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

export const determinePose = (
	object: WorldObject,
	pose: WorldObject['pose'] | undefined
): WorldObject['pose'] => {
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

export class WorldObject<T extends Geometries = Geometries> {
	uuid: string
	name: string
	referenceFrame = $state.raw<string>()
	pose = $state.raw<Pose>(createPose())
	geometry?: T
	metadata = $state<Metadata>({})
	localEditedPose = $state.raw<Pose>(createPose())

	constructor(name: string, pose?: Pose, parent = 'world', geometry?: T, metadata?: Metadata) {
		this.uuid = MathUtils.generateUUID()
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

const poseToMatrix = (pose: WorldObject['pose']) => {
	const matrix = new Matrix4()
	const poseQuaternion = new Quaternion().setFromAxisAngle(
		new Vector3(pose.oX, pose.oY, pose.oZ),
		pose.theta * (Math.PI / 180)
	)
	matrix.makeRotationFromQuaternion(poseQuaternion)
	matrix.setPosition(new Vector3(pose.x, pose.y, pose.z))
	return matrix
}

const matrixToPose = (matrix: Matrix4) => {
	const pose = createPose()
	const translation = new Vector3()
	const quaternion = new Quaternion()
	matrix.decompose(translation, quaternion, new Vector3())
	pose.x = translation.x
	pose.y = translation.y
	pose.z = translation.z

	const s = Math.sqrt(1 - quaternion.w * quaternion.w)
	if (s < 0.000001) {
		pose.oX = 0
		pose.oY = 0
		pose.oZ = 1
		pose.theta = 0
	} else {
		pose.oX = quaternion.x / s
		pose.oY = quaternion.y / s
		pose.oZ = quaternion.z / s
		pose.theta = Math.acos(quaternion.w) * 2 * (180 / Math.PI)
	}

	return pose
}
