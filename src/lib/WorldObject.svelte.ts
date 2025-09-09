import type { Geometry, Pose, TransformWithUUID } from '@viamrobotics/sdk'
import { BatchedMesh, Box3, MathUtils, Object3D, Vector3, type ColorRepresentation } from 'three'
import { createPose } from './transform'

export type PointsGeometry = { case: 'points'; value: Float32Array<ArrayBuffer> }
export type LinesGeometry = { case: 'line'; value: Float32Array }

export type Geometries = Geometry['geometryType'] | PointsGeometry | LinesGeometry

export type Metadata = {
	colors?: Float32Array
	color?: ColorRepresentation
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

export const fromTransform = (transform: TransformWithUUID) => {
	const metadata: Metadata = { ...transform.metadata?.fields }
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
