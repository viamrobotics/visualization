import {
	Struct,
	type Geometry,
	type PlainMessage,
	type PointCloud,
	type PointCloudHeader,
	type Pose,
	type PoseInFrame,
	type TransformWithUUID,
} from '@viamrobotics/sdk'
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
import { setIn, setInUnsafe } from '@thi.ng/paths'

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

export interface WorldObjectUpdate<T extends Geometries = Geometries> {
	name?: string
	pose?: Pose
	referenceFrame?: string
	geometry?: T
	metadata?: Metadata
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

export const parseMetadata = (fields: PlainMessage<Struct>['fields'] = {}) => {
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

export type WorldObjectPhysicalObject<T extends Geometries = Geometries> =
	TransformWithUUID extends { physicalObject?: infer P }
		? P extends Geometry
			? Omit<P, 'geometryType'> & { geometryType: T }
			: never
		: never

export type WorldObjectTransform<T extends Geometries = Geometries> = Omit<
	TransformWithUUID,
	'metadata' | 'physicalObject' | 'uuid'
> & {
	physicalObject?: WorldObjectPhysicalObject<T>
	metadata: Metadata
}

export const fromTransform = (transform: TransformWithUUID): WorldObject => {
	const worldObject = new WorldObject(
		transform.uuidString,
		transform.referenceFrame,
		transform.poseInObserverFrame,
		transform.physicalObject,
		parseMetadata(transform.metadata?.fields)
	)

	return worldObject
}

export class WorldObject<T extends Geometries = Geometries> {
	private transform = $state.raw<WorldObjectTransform<T>>({
		uuidString: MathUtils.generateUUID(),
		referenceFrame: 'Unnamed World Object',
		poseInObserverFrame: {
			referenceFrame: 'world',
		},
		physicalObject: undefined,
		metadata: {},
	})

	constructor(
		uuidString: string = MathUtils.generateUUID(),
		referenceFrame: string = 'Unnamed World Object',
		poseInObserverFrame: PoseInFrame = {
			referenceFrame: 'world',
		},
		physicalObject?: WorldObjectPhysicalObject<T>,
		metadata: Metadata = {}
	) {
		this.transform = {
			uuidString,
			referenceFrame,
			poseInObserverFrame,
			physicalObject,
			metadata,
		}
	}

	get uuid() {
		return this.transform.uuidString
	}

	set uuid(uuid: string) {
		this.transform.uuidString = uuid
	}

	get name() {
		return this.transform.referenceFrame
	}

	get pose() {
		return this.transform.poseInObserverFrame?.pose
	}

	set pose(pose: Pose | undefined) {
		if (!this.transform.poseInObserverFrame) {
			this.transform.poseInObserverFrame = {
				referenceFrame: 'world',
				pose,
			}
		} else {
			this.transform.poseInObserverFrame.pose = pose
		}
	}

	get referenceFrame() {
		return this.transform.poseInObserverFrame?.referenceFrame ?? 'world'
	}

	get geometry() {
		return this.transform.physicalObject?.geometryType
	}

	get metadata() {
		return this.transform.metadata
	}

	update = (
		changes: [
			path: readonly (string | number)[],
			value: Parameters<typeof setIn<WorldObjectTransform>>[2],
		][]
	) => {
		let next: WorldObjectTransform<T> = { ...this.transform }
		for (const [path, value] of changes) {
			const key = path.join('.')
			// Ignore renderer-managed point cloud payload/header changes
			if (
				key.includes('physicalObject.geometryType.value.pointCloud') ||
				key.includes('physicalObject.geometryType.value.header')
			) {
				continue
			}
			next = setInUnsafe(next, path, value)
		}
		this.transform = next
	}
}

export class PointCloudWorldObject extends WorldObject<{ case: 'pointcloud'; value: PointCloud }> {
	physicalObject: WorldObjectPhysicalObject<{ case: 'pointcloud'; value: PointCloud }>
	private _updates: {
		header?: PointCloudHeader
		data: Uint8Array
		ts: number
	}[] = []

	constructor(
		uuid: string = MathUtils.generateUUID(),
		referenceFrame: string,
		poseInObserverFrame: PoseInFrame = {
			referenceFrame: 'world',
		},
		physicalObject: WorldObjectPhysicalObject<{ case: 'pointcloud'; value: PointCloud }>,
		metadata?: Metadata
	) {
		super(uuid, referenceFrame, poseInObserverFrame, physicalObject, metadata)
		this.physicalObject = physicalObject
	}

	enqueueUpdate(header: PointCloudHeader | undefined, data: Uint8Array) {
		this._updates.push({ header, data, ts: performance.now() })
	}

	setFull(header: PointCloudHeader, data: Uint8Array) {
		this.physicalObject.geometryType.value.header = header
		this.physicalObject.geometryType.value.pointCloud = data
		this.enqueueUpdate(header, data)
	}

	drainUpdates() {
		const out = this._updates
		this._updates = []
		return out
	}
}
