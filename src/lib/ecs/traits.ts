import type { GLTF as ThreeGltf } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { trait } from 'koota'
import { BufferGeometry as ThreeBufferGeometry } from 'three'
import { Geometry as ViamGeometry } from '@viamrobotics/sdk'
import { createBox, createCapsule, createSphere } from '$lib/geometry'
import { parsePlyInput } from '$lib/ply'

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
export const Color = trait({ r: 0, g: 0, b: 0 })

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

export const PointColor = trait({ r: 0, g: 0, b: 0 })

/** format [x, y, z, ...] */
export const LinePositions = trait(() => new Float32Array())
export const PointsPositions = trait(() => new Float32Array())

export const BufferGeometry = trait(() => new ThreeBufferGeometry())

/** format [r, g, b, ...] */
export const VertexColors = trait(() => new Float32Array())

export const GLTF = trait(() => ({
	source: { url: '' } as { url: string } | { gltf: ThreeGltf } | { glb: Uint8Array<ArrayBuffer> },
	animationName: '',
}))

export const Scale = trait({ x: 1, y: 1, z: 1 })

export const FramesAPI = trait()
export const GeometriesAPI = trait()
export const DrawAPI = trait()
export const WorldStateStoreAPI = trait()
export const SnapshotAPI = trait()

/**
 * Marker trait for entities created from user-dropped files (PLY, PCD, etc.)
 */
export const DroppedFile = trait()

// === Shape Properties ===
/**
 * Point size, in mm
 */
export const PointSize = trait(() => 10)

/**
 * Line width, in mm
 */
export const LineWidth = trait(() => 5)

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
