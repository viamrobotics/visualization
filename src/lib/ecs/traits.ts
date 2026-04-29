import type { GLTF as ThreeGltf } from 'three/examples/jsm/loaders/GLTFLoader.js'

import { Geometry as ViamGeometry } from '@viamrobotics/sdk'
import { type ConfigurableTrait, type Entity, trait } from 'koota'
import { BufferGeometry as ThreeBufferGeometry } from 'three'

import { createBufferGeometry, updateBufferGeometry } from '$lib/attribute'
import { ColorFormat } from '$lib/buf/draw/v1/metadata_pb'
import { createBox, createCapsule, createSphere } from '$lib/geometry'
import { parsePcdInWorker } from '$lib/loaders/pcd'
import { parsePlyInput } from '$lib/ply'

export const Name = trait(() => '')
export const Parent = trait(() => 'world')
export const UUID = trait(() => '')

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

export const Positions = trait(() => new Float32Array() as Float32Array)

/** Per-vertex RGB colors packed as [r, g, b, ...], stride of 3, values 0-255. */
export const Colors = trait(() => new Uint8Array() as Uint8Array)

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

export const BufferGeometry = trait(() => new ThreeBufferGeometry())

export const GLTF = trait(() => ({
	source: { url: '' } as { url: string } | { gltf: ThreeGltf } | { glb: Uint8Array },
	animationName: '',
}))

export const Scale = trait({ x: 1, y: 1, z: 1 })

export const FramesAPI = trait(() => true)
export const GeometriesAPI = trait(() => true)
export const DrawAPI = trait(() => true)
export const DrawServiceAPI = trait(() => true)
export const WorldStateStoreAPI = trait(() => true)
export const SnapshotAPI = trait(() => true)

/**
 * Marker trait for entities created from user-dropped files (PLY, PCD, etc.)
 */
export const DroppedFile = trait(() => true)

export const ShowAxesHelper = trait(() => true)

/**
 * Marker trait for entities that should be rendered in screen space (CSS pixels)
 */
export const ScreenSpace = trait(() => true)

/**
 * Point size, in mm
 */
export const PointSize = trait(() => 5)

/**
 * Line positions, format [x, y, z, ...]
 */
export const LinePositions = trait(() => new Float32Array() as Float32Array)

/**
 * Line width, in mm when in world units, or CSS pixels when in screen space
 */
export const LineWidth = trait(() => 5)

/**
 * Dot colors for line vertices, format [r, g, b, a, ...]
 */
export const DotColors = trait(() => new Uint8Array() as Uint8Array)

/**
 * Dot size for line vertices, in mm when in world units, or CSS pixels when in screen space
 */
export const DotSize = trait(() => 10)

export const ReferenceFrame = trait(() => true)

/**
 * Tracks chunk loading progress for progressively-loaded entities.
 * `loaded` is the number of elements received so far; `total` is the target.
 */
export const ChunkProgress = trait({ loaded: 0, total: 0 })

/**
 * Interaction layers for entities
 */
export type InteractionLayerValue = 'selectTool'
export const SelectToolInteractionLayer = trait(() => true)

/**
 * This entity can be safely removed from the scene by the user
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

export const getParentTrait = (parent: string | undefined): ConfigurableTrait[] =>
	!parent || parent === 'world' ? [] : [Parent(parent)]

export const setParentTrait = (entity: Entity, parent: string | undefined) => {
	if (!parent || parent === 'world') {
		entity.remove(Parent)
		return
	}

	if (entity.has(Parent)) {
		entity.set(Parent, parent)
	} else {
		entity.add(Parent(parent))
	}
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
	} else if (geometry.geometryType.case === 'pointcloud') {
		updatePointCloud(entity, geometry.geometryType.value.pointCloud)
	}
}

const updatePointCloud = (entity: Entity, pointCloud: Uint8Array): void => {
	parsePcdInWorker(new Uint8Array(pointCloud))
		.then((parsed) => {
			if (!entity.isAlive()) return

			const buffer = entity.get(BufferGeometry)
			let colors = parsed.colors
			if (buffer) {
				// Reapply single color trait if the point count changed
				if (parsed.colors === undefined) {
					const color = entity.get(Color)
					if (color) {
						const newCount = parsed.positions.length / 3
						colors = new Uint8Array(newCount * 3)
						const r = Math.round(color.r * 255)
						const g = Math.round(color.g * 255)
						const b = Math.round(color.b * 255)
						for (let i = 0; i < newCount; i++) {
							colors[i * 3] = r
							colors[i * 3 + 1] = g
							colors[i * 3 + 2] = b
						}
					}
				}

				// When the point count changes, attributes must be reallocated.
				const oldCount = buffer.getAttribute('position').count
				const newCount = parsed.positions.length / 3
				if (oldCount === newCount) {
					updateBufferGeometry(buffer, parsed.positions, {
						colors,
						colorFormat: ColorFormat.RGB,
					})
				} else {
					const fresh = createBufferGeometry(parsed.positions, {
						colors,
						colorFormat: ColorFormat.RGB,
					})
					buffer.dispose()
					entity.set(BufferGeometry, fresh)
				}

				return
			}

			entity.remove(Box, Capsule, Sphere)
			entity.add(
				BufferGeometry(
					createBufferGeometry(parsed.positions, {
						colors: parsed.colors,
						colorFormat: ColorFormat.RGB,
					})
				)
			)
			if (!entity.has(Points)) entity.add(Points)
		})
		.catch((error) => {
			console.error('Failed to update pointcloud buffer geometry:', error)
		})
}
