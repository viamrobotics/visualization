import type { Geometry, Pose, TransformWithUUID } from '@viamrobotics/sdk'
import {
	BatchedMesh,
	Box3,
	Color,
	MathUtils,
	Matrix4,
	Object3D,
	Quaternion,
	Vector3,
	type ColorRepresentation,
	type RGB,
} from 'three'
import { createPose } from './transform'

export type PointsGeometry = {
	center: undefined
	geometryType: { case: 'points'; value: Float32Array<ArrayBuffer> }
}

export type LinesGeometry = {
	center: undefined
	geometryType: { case: 'line'; value: Float32Array }
}

export type Geometries = Geometry | PointsGeometry | LinesGeometry

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
	metadata: Metadata
	localEditedPose = $state.raw<Pose>(createPose())

	constructor(name: string, pose?: Pose, parent = 'world', geometry?: T, metadata?: Metadata) {
		this.uuid = MathUtils.generateUUID()
		this.name = name
		this.referenceFrame = parent

		this.geometry = geometry
		this.metadata = metadata ?? {}

		if (pose) {
			this.pose = pose
			this.localEditedPose = { ...pose }
		}
	}
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type UnwrapValue = { kind: { case: string; value: any } }
const unwrapValue = (value: UnwrapValue): unknown => {
	if (!value?.kind) return value

	switch (value.kind.case) {
		case 'numberValue':
		case 'stringValue':
		case 'boolValue':
			return value.kind.value
		case 'structValue': {
			// Recursively unwrap nested struct
			const result: Record<string, unknown> = {}
			for (const [key, val] of Object.entries(value.kind.value.fields || {})) {
				result[key] = unwrapValue(val as UnwrapValue)
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

const parseMetadata = (metadata: Record<string, UnwrapValue>) => {
	let json: Metadata = {}

	for (const [k, v] of Object.entries(metadata)) {
		const unwrappedValue = unwrapValue(v)

		// TODO: Remove special case and add better handling for metadata
		if (k === 'color' && unwrappedValue && typeof unwrappedValue === 'object') {
			const { r, g, b } = unwrappedValue as RGB
			json[k] = new Color().setRGB(r / 255, g / 255, b / 255)
		} else {
			json = { ...json, [k]: unwrappedValue }
		}
	}

	return json
}

export const fromTransform = (transform: TransformWithUUID) => {
	const metadata: Metadata = transform.metadata
		? parseMetadata(transform.metadata.fields as Record<string, UnwrapValue>)
		: {}
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
