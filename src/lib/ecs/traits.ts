import type { GLTF as ThreeGltf } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { relation, trait } from 'koota'
import { MathUtils, BufferGeometry as ThreeBufferGeometry, type Vector3 } from 'three'
import { Geometry as ViamGeometry } from '@viamrobotics/sdk'
import { createBox, createCapsule, createSphere } from '$lib/geometry'
import { parsePlyInput } from '$lib/ply'

export const UUID = trait(() => MathUtils.generateUUID())
export const Name = trait(() => '')
export const Parent = trait(() => 'world')
export const EditedParent = trait(() => 'world')

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

/**
 * An entity with data from the FrameSystemConfig() API
 */
export const FramesAPI = trait()

export const ChildOf = relation()

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

	return trait()
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
