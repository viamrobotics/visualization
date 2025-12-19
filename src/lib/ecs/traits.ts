import type { GLTF as ThreeGltf } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { trait } from 'koota'
import { MathUtils, BufferGeometry as ThreeBufferGeometry, type Vector3 } from 'three'
import { Geometry as ViamGeometry } from '@viamrobotics/sdk'
import { createBox, createCapsule, createSphere } from '$lib/geometry'
import { parsePlyInput } from '$lib/ply'
import { ModelAsset } from '$lib/draw/v1/drawing_pb'

export const UUID = trait(() => MathUtils.generateUUID())
export const Name = trait(() => '')
export const Parent = trait(() => 'world')

export const Pose = trait({ x: 0, y: 0, z: 0, oX: 0, oY: 0, oZ: 1, theta: 0 })
export const EditedPose = trait({ x: 0, y: 0, z: 0, oX: 0, oY: 0, oZ: 1, theta: 0 })
export const Center = trait({ x: 0, y: 0, z: 0, oX: 0, oY: 0, oZ: 1, theta: 0 })

export const Instance = trait({
	meshID: -1,
	instanceID: -1,
})
export const Opacity = trait(() => 1)

/**
 * The color of an object
 * @default { r: 1, g: 0, b: 0 }
 */
export const Color = trait({ r: 1, g: 0, b: 0 })

export const Arrow = trait()

/**
 * A box, in mm
 */
export const Box = trait({ x: 200, y: 200, z: 200 })

/**
 * A capsule, in mm
 */
export const Capsule = trait({ l: 200, r: 50 })

/**
 * A sphere, in mm
 */
export const Sphere = trait({ r: 200 })

/**
 *
 */
export const DottedLineColor = trait({ r: 0, g: 0, b: 0 })

export const LineGeometry = trait(() => [] as Vector3[])
export const PointsGeometry = trait(() => new Float32Array())
export const BufferGeometry = trait(() => new ThreeBufferGeometry())
export const VertexColors = trait(() => new Float32Array())

export const GLTF = trait(() => ({}) as ThreeGltf)

export const DrawAPI = trait()
export const GeometriesAPI = trait()
export const WorldStateStoreAPI = trait()
export const SnapshotAPI = trait()

/**
 * Marker trait for entities created from user-dropped files (PLY, PCD, etc.)
 */
export const DroppedFile = trait()

/**
 * Packed poses (sans-theta) buffer: [x, y, z, ox, oy, oz, ...]
 */
export const Arrows = trait(() => new Uint8Array(0))

/**
 * Packed positions buffer: [x, y, z, ...]
 */
export const Positions = trait(() => new Uint8Array(0))

/**
 * Packed poses buffer: [x, y, z, ox, oy, oz, theta, ...]
 */
export const Poses = trait(() => new Uint8Array(0))

/**
 * Knots buffer: [k0, k1, ...]
 */
export const Knots = trait(() => new Uint8Array(0))

/**
 * Weights buffer, optional: [w0, w1, ...]
 */
export const Weights = trait(() => new Uint8Array(0) as Uint8Array<ArrayBufferLike>)

// === Shape Properties ===

/**
 * Curve degree, defaults to 3
 */
export const Degree = trait(() => 3)

/**
 * Point size, in mm
 */
export const PointSize = trait(() => 10)

/**
 * Line width, in mm
 */
export const LineWidth = trait(() => 5)

/**
 * RGBA colors buffer: [r, g, b, a, ...] as uint8 (0-255)
 * Can be single color or per-vertex colors.
 */
export const ColorsRGBA = trait(() => new Uint8Array(0) as Uint8Array<ArrayBufferLike>)

export const MimeType = trait(() => '')
export const SizeBytes = trait(() => 0)
export const URLContent = trait(() => ({ case: 'url', value: '' }))
export const DataContent = trait(() => ({
	case: 'data',
	value: new Uint8Array(0) as Uint8Array<ArrayBufferLike>,
}))
export const Scale = trait({ x: 1, y: 1, z: 1 })
export const AnimationName = trait(() => '')

/**
 * An entity with data from the FrameSystemConfig() API
 */
export const FramesAPI = trait()

export const ReferenceFrame = trait()

export const Geometry = (geometry: ViamGeometry) => {
	if (geometry.geometryType.case === 'box') {
		return Box(createBox(geometry.geometryType.value))
	} else if (geometry.geometryType.case === 'capsule') {
		return Capsule(createCapsule(geometry.geometryType.value))
	} else if (geometry.geometryType.case === 'sphere') {
		return Sphere(createSphere(geometry.geometryType.value))
	} else if (geometry.geometryType.case === 'mesh') {
		return BufferGeometry(parsePlyInput(geometry.geometryType.value.mesh))
	}

	return ReferenceFrame
}

export const updateGeometry = (geometry: ViamGeometry) => {
	if (geometry.geometryType.case === 'box') {
		return [Box, createBox(geometry.geometryType.value)]
	} else if (geometry.geometryType.case === 'capsule') {
		return [Capsule, createCapsule(geometry.geometryType.value)]
	} else if (geometry.geometryType.case === 'sphere') {
		return [Sphere, createSphere(geometry.geometryType.value)]
	} else if (geometry.geometryType.case === 'mesh') {
		return [BufferGeometry, parsePlyInput(geometry.geometryType.value.mesh)]
	}

	return []
}
