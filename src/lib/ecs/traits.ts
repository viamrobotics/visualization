import type { GLTF as ThreeGltf } from 'three/examples/jsm/loaders/GLTFLoader.js'

import { Geometry as ViamGeometry } from '@viamrobotics/sdk'
import { type Entity, trait } from 'koota'
import { BufferGeometry as ThreeBufferGeometry } from 'three'

import { createBox, createCapsule, createSphere } from '$lib/geometry'
import { parsePlyInput } from '$lib/ply'

export const Name = trait(() => '')
export const Parent = trait(() => 'world')

export const Pose = trait({ x: 0, y: 0, z: 0, oX: 0, oY: 0, oZ: 1, theta: 0 })
export const EditedPose = trait({ x: 0, y: 0, z: 0, oX: 0, oY: 0, oZ: 1, theta: 0 })
export const Center = trait({ x: 0, y: 0, z: 0, oX: 0, oY: 0, oZ: 1, theta: 0 })

export const InstancedPose = trait({
	x: 0,
	y: 0,
	z: 0,
	oX: 0,
	oY: 0,
	oZ: 1,
	theta: 0,
	index: -1,
})

export const WorldPose = trait({
	x: 0,
	y: 0,
	z: 0,
	oX: 0,
	oY: 0,
	oZ: 1,
	theta: 0,
})

export const Hovered = trait(() => true)
export const Invisible = trait(() => true)

/**
 * Represents that an entity is composed of many instances, so that the treeview and
 * details panel may display all instances
 */
export const Instanced = trait(() => true)

export const Instance = trait({
	meshID: -1,
	instanceID: -1,
})

export const RenderOrder = trait(() => 0)

export const Opacity = trait(() => 1)

/**
 * The color of an object
 * @default { r: 1, g: 0, b: 0 }
 */
export const Color = trait({ r: 0, g: 0, b: 0 })

/**
 * Material properties
 */
export const Material = trait({
	depthTest: false,
})

export const DepthTest = trait(() => true)

export const Arrow = trait(() => true)

export const Positions = trait(() => new Float32Array())

/** Per-vertex RGB colors packed as [r, g, b, ...], stride of 3, values 0-255. */
export const Colors = trait(() => new Uint8Array())

/**
 * Per-vertex opacity values packed as uint8 (0-255).
 */
export const Opacities = trait(() => new Uint8Array())

export const Instances = trait({
	count: 0,
})

export const Arrows = trait({
	headAtPose: true,
})

/**
 * Render entity as points
 */
export const Points = trait(() => true)

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

export const BufferGeometry = trait(() => new ThreeBufferGeometry())

export const GLTF = trait(() => ({
	source: { url: '' } as { url: string } | { gltf: ThreeGltf } | { glb: Uint8Array<ArrayBuffer> },
	animationName: '',
}))

export const Scale = trait({ x: 1, y: 1, z: 1 })

export const FramesAPI = trait(() => true)
export const GeometriesAPI = trait(() => true)
export const DrawAPI = trait(() => true)
export const WorldStateStoreAPI = trait(() => true)
export const SnapshotAPI = trait(() => true)

/**
 * Marker trait for entities created from user-dropped files (PLY, PCD, etc.)
 */
export const DroppedFile = trait(() => true)

export const ShowAxesHelper = trait(() => true)

// === Shape Properties ===
/**
 * Point size, in mm
 */
export const PointSize = trait(() => 10)

/**
 * Line width, in mm
 */
export const LineWidth = trait(() => 5)

export const ReferenceFrame = trait(() => true)

/**
 * This entity can be safetly removed from the scene by the user
 */
export const Removable = trait(() => true)

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

export const updateGeometryTrait = (entity: Entity, geometry?: ViamGeometry) => {
	if (!geometry) {
		entity.remove(Box, Capsule, Sphere, BufferGeometry)
		return
	}

	if (geometry.geometryType.case === 'box') {
		if (entity.has(Box)) {
			entity.set(Box, createBox(geometry.geometryType.value))
		} else {
			entity.remove(Capsule, Sphere, BufferGeometry)
			entity.add(Box(createBox(geometry.geometryType.value)))
		}
	} else if (geometry.geometryType.case === 'capsule') {
		if (entity.has(Capsule)) {
			entity.set(Capsule, createCapsule(geometry.geometryType.value))
		} else {
			entity.remove(Box, Sphere, BufferGeometry)
			entity.add(Capsule(createCapsule(geometry.geometryType.value)))
		}
	} else if (geometry.geometryType.case === 'sphere') {
		if (entity.has(Sphere)) {
			entity.set(Sphere, createSphere(geometry.geometryType.value))
		} else {
			entity.remove(Box, Capsule, BufferGeometry)
			entity.add(Sphere(createSphere(geometry.geometryType.value)))
		}
	} else if (geometry.geometryType.case === 'mesh') {
		if (entity.has(BufferGeometry)) {
			entity.set(BufferGeometry, parsePlyInput(geometry.geometryType.value.mesh))
		} else {
			entity.remove(Box, Sphere, Capsule)
			entity.add(BufferGeometry(parsePlyInput(geometry.geometryType.value.mesh)))
		}
	}
}
