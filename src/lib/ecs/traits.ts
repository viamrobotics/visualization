import type { GLTF as ThreeGltf } from 'three/examples/jsm/loaders/GLTFLoader.js'

import { type Entity, trait } from 'koota'
import { Matrix4, BufferGeometry as ThreeBufferGeometry } from 'three'

import { createBufferGeometry, updateBufferGeometry } from '$lib/attribute'
import { ColorFormat } from '$lib/buf/draw/v1/metadata_pb'
import {
	createBox,
	createCapsule,
	createCylinder,
	createSphere,
	type Geometry as ViamGeometry,
} from '$lib/geometry'
import { parsePcdInWorker } from '$lib/loaders/pcd'
import { Pose, type PosePatch } from '$lib/math'
import { isParsedFrom, parseMesh } from '$lib/mesh'
import { attachPointsBvh } from '$lib/three/pointsBvh'

import { setOrAddTrait } from './setOrAddTrait'

export const Name = trait(() => '')
export const UUID = trait(() => '')

/**
 * Set on an entity whose desired parent (by name) doesn't yet exist in the
 * world. Replaced with `relations.ChildOf(parentEntity)` once a frame with
 * the matching `Name` is added. Managed by the hierarchy module — call sites
 * should use `hierarchy.setParent` / `hierarchy.parentTraits` rather than
 * adding this trait directly.
 */
export const Orphan = trait(() => '')

/**
 * Static positional offset (e.g. center of a geometry). Stored as a Pose
 * for the rare cases that need OV+theta semantics (currently unused).
 * Never composed through the parent chain — the `WorldMatrix` system
 * doesn't read it.
 */
export const Center = trait({ x: 0, y: 0, z: 0, oX: 0, oY: 0, oZ: 1, theta: 0 })

/**
 * Local-to-parent transform. Stored AoS — one `Matrix4` instance per entity —
 * not as 16 SoA fields. Every consumer reads all 16 elements of one entity at
 * a time (`Object3D.matrix.copy`, batched-mesh per-instance writes, the
 * world-matrix walk). SoA would allocate a fresh 16-field object on every
 * `entity.get(Matrix)`; AoS returns the `Matrix4` reference, zero allocation
 * per read, and plugs straight into Three.js. The trade-off — losing
 * column-iteration locality — is fine because no system iterates a single
 * matrix element across entities.
 *
 * Update pattern: read the `Matrix4` and mutate in place, then call
 * `entity.changed(Matrix)` so `onChange` listeners (the `WorldMatrix` system,
 * etc.) fire. Allocate a fresh `Matrix4` only on add.
 */
export const Matrix = trait(() => new Matrix4())

/** User-staged local transform written by frame-editing tools (see `FrameEditor`). */
export const EditedMatrix = trait(() => new Matrix4())

/**
 * Live local transform from the robot's kinematics. Composed with `Matrix`
 * (network baseline) and `EditedMatrix` to produce the rendered transform.
 */
export const LiveMatrix = trait(() => new Matrix4())

/**
 * Cumulative world-space transform — `parent.WorldMatrix × local rendered`.
 * Maintained by `provideWorldMatrix`. Read by hover label placement,
 * batched-mesh population, and any other consumer that needs world-space.
 */
export const WorldMatrix = trait(() => new Matrix4())

/**
 * World-space transform of a hovered instance inside a points/arrows batch,
 * paired with the instance index in the parent batched mesh.
 */
export const InstancedMatrix = trait(() => ({
	matrix: new Matrix4(),
	index: -1,
}))

export const Hovered = trait(() => true)
export const Invisible = trait(() => true)

/**
 * Suppresses the default frame-style world/local pose and parent-frame blocks
 * in the details panel. Entities that render their own pose UI via the
 * `details-extensions` portal target (e.g. gizmo plugin entities) opt in by
 * adding this trait.
 */
export const CustomDetails = trait()

/**
 * True when the entity itself, or any of its parents up the `ChildOf`
 * chain, has `Invisible`. Maintained by `provideInheritedInvisible`;
 * don't add or remove it by hand — toggle `Invisible` and the cascade
 * follows.
 */
export const InheritedInvisible = trait(() => true)

/**
 * Marks a geometry entity whose 3D arm model is being rendered in place of its
 * collider, so the collider renderers (`Mesh`, `Boxes`, `Capsules`, `Cylinders`,
 * `Spheres`) skip it. Maintained by `provide3DModels`; kept separate from `Invisible` so
 * it never disturbs the user's own visibility toggles or hides the CAD model.
 */
export const ColliderHidden = trait()

/**
 * Represents that an entity is composed of many instances, so that the treeview and
 * details panel may display all instances
 */
export const InstanceId = trait(() => -1)

export const Instance = trait({
	meshID: -1,
	instanceID: -1,
})

export const Instances = trait({
	count: 0,
})

export const RenderOrder = trait(() => 0)

export const Opacity = trait(() => 1)

/**
 * The color of an object
 * @default { r: 0, g: 0, b: 0 }
 */
export const Color = trait({ r: 0, g: 0, b: 0 })

export const Material = trait({
	depthTest: false,
	depthWrite: true,
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

export const Arrows = trait({
	headAtPose: true,
})

export const Points = trait(() => true)

/**
 * A cloud whose buffer was shuffled at parse time. `total` is the live point count, tracked
 * because draw range alone can't tell a decimated cloud from one that shrank into a reused
 * buffer. `shuffled` is how many leading points are a uniform spatial subsample — decimating
 * past it would draw the scan-ordered tail, which is a wedge rather than a sample.
 */
export const PointSampling = trait({ total: 0, shuffled: 0 })

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
 * A cylinder, in mm, about the Z axis. `l` is the full height, not a half
 * extent. `capped` false is an open tube, which renders without end caps.
 */
export const Cylinder = trait({ r: 50, l: 200, capped: true })

export const BufferGeometry = trait(() => new ThreeBufferGeometry())

export const GLTF = trait(() => ({
	source: { url: '' } as { url: string } | { gltf: ThreeGltf } | { glb: Uint8Array },
	animationName: '',
}))

export const FramesAPI = trait(() => true)

/**
 * A link inside a component's kinematic model. IK re-solves its pose, so it is
 * neither rigid with its parent nor drivable by the motion service.
 */
export const KinematicLink = trait(() => true)

/**
 * Drawn into the scene through the draw API, rather than sourced from the robot.
 * The distinction drives grouping in the world tree and which entities may be
 * related to one another.
 */
export const DrawAPI = trait(() => true)
export const WorldStateStoreAPI = trait(() => true)
export const SnapshotAPI = trait(() => true)

/** A cloud from a camera's `GetPointCloud`. */
export const PointCloudAPI = trait(() => true)

/** A cloud or bounding geometry from a vision service's `GetObjectPointClouds`. */
export const PointCloudObjectAPI = trait(() => true)

/**
 * Marker trait for entities created from user-dropped files (PLY, PCD, etc.)
 */
export const DroppedFile = trait(() => true)

/**
 * A scene aid the user placed by hand — a coordinate system, reference plane,
 * reference solid, arrow, or measurement — rather than anything sourced from the
 * robot. Lives in core, not in the `Gizmos` plugin, because the world tree's
 * folder taxonomy is a static array here and a folder keyed on a plugin-owned
 * trait would invert the dependency.
 */
export const Gizmo = trait()

/**
 * A component that the part config declares with no frame. It carries a `Name`
 * so the world tree can list it, and nothing else — there is no scene object
 * behind it. Queries that assume one (labels, orphan resolution, relationship
 * targets) exclude it with `Not(FramelessComponent)`.
 */
export const FramelessComponent = trait()

/**
 * This entity has somewhere for an edit to land: a config entry, or an ad-hoc
 * geometry that stages into `Matrix`. Opt-in, so an unrecognized frame is inert.
 */
export const Editable = trait(() => true)

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

export type InteractionLayerValue = 'selectTool'
export const SelectToolInteractionLayer = trait(() => true)

/**
 * Marker for entities that exist to be looked at, not interacted with — move
 * ghosts, previews, and other transient display-only geometry. Pointer events
 * that land on one are ignored and left to propagate, so whatever sits behind
 * it hovers and selects as if the entity weren't there.
 */
export const NonSelectable = trait(() => true)

export const Selected = trait()

export const Removable = trait(() => true)

export const Geometry = (geometry: ViamGeometry) => {
	if (geometry.geometryType.case === 'box') {
		return Box(createBox(geometry.geometryType.value))
	} else if (geometry.geometryType.case === 'capsule') {
		return Capsule(createCapsule(geometry.geometryType.value))
	} else if (geometry.geometryType.case === 'sphere') {
		return Sphere(createSphere(geometry.geometryType.value))
	} else if (geometry.geometryType.case === 'cylinder') {
		return Cylinder(createCylinder(geometry.geometryType.value))
	} else if (geometry.geometryType.case === 'mesh') {
		return BufferGeometry(parseMesh(geometry.geometryType.value))
	}

	return ReferenceFrame
}

export const updateGeometryTrait = (entity: Entity, geometry?: ViamGeometry) => {
	if (!geometry) {
		entity.remove(Box, Capsule, Cylinder, Sphere, BufferGeometry)
		return
	}

	if (geometry.geometryType.case === 'box') {
		const next = createBox(geometry.geometryType.value)
		if (entity.has(Box)) {
			const cur = entity.get(Box)!
			if (cur.x !== next.x || cur.y !== next.y || cur.z !== next.z) entity.set(Box, next)
		} else {
			entity.remove(Capsule, Cylinder, Sphere, BufferGeometry)
			entity.add(Box(next))
		}
	} else if (geometry.geometryType.case === 'capsule') {
		const next = createCapsule(geometry.geometryType.value)
		if (entity.has(Capsule)) {
			const cur = entity.get(Capsule)!
			if (cur.r !== next.r || cur.l !== next.l) entity.set(Capsule, next)
		} else {
			entity.remove(Box, Cylinder, Sphere, BufferGeometry)
			entity.add(Capsule(next))
		}
	} else if (geometry.geometryType.case === 'sphere') {
		const next = createSphere(geometry.geometryType.value)
		if (entity.has(Sphere)) {
			const cur = entity.get(Sphere)!
			if (cur.r !== next.r) entity.set(Sphere, next)
		} else {
			entity.remove(Box, Capsule, Cylinder, BufferGeometry)
			entity.add(Sphere(next))
		}
	} else if (geometry.geometryType.case === 'cylinder') {
		const next = createCylinder(geometry.geometryType.value)
		if (entity.has(Cylinder)) {
			const cur = entity.get(Cylinder)!
			if (cur.r !== next.r || cur.l !== next.l || cur.capped !== next.capped) {
				entity.set(Cylinder, next)
			}
		} else {
			entity.remove(Box, Capsule, Sphere, BufferGeometry)
			entity.add(Cylinder(next))
		}
	} else if (geometry.geometryType.case === 'mesh') {
		const mesh = geometry.geometryType.value
		if (entity.has(BufferGeometry)) {
			const old = entity.get(BufferGeometry)
			// Reparsing an STL/PLY, re-uploading it, and rebuilding its EdgesGeometry all cost far
			// more than the byte compare that rules them out.
			if (old && isParsedFrom(old, mesh)) return
			entity.set(BufferGeometry, parseMesh(mesh))
			old?.dispose()
		} else {
			entity.remove(Box, Sphere, Capsule, Cylinder)
			entity.add(BufferGeometry(parseMesh(mesh)))
		}
	} else if (geometry.geometryType.case === 'pointcloud') {
		updatePointCloud(entity, geometry.geometryType.value.pointCloud)
	}
}

/**
 * Patches an entity's `Matrix` trait in-place via the `Pose` round-trip
 * (`setFromMatrix4` → `merge` → `toMatrix4`), then signals `entity.changed(Matrix)`.
 * No-ops silently if the entity has no `Matrix` trait, or if the patch would
 * change nothing.
 */
export const writeMatrix = (entity: Entity, patch: PosePatch) => {
	const matrix = entity.get(Matrix)
	if (!matrix) return

	const defined = Object.values(patch).some((value) => value !== undefined)
	if (!defined) return

	new Pose().setFromMatrix4(matrix).merge(patch).toMatrix4(matrix)
	entity.changed(Matrix)
}

const updatePointCloud = (entity: Entity, pointCloud: Uint8Array): void => {
	parsePcdInWorker(new Uint8Array(pointCloud))
		.then((parsed) => {
			if (!entity.isAlive()) return

			setOrAddTrait(entity, PointSampling, {
				total: parsed.positions.length / 3,
				shuffled: parsed.shuffled,
			})

			const buffer = entity.get(BufferGeometry)
			let colors = parsed.colors
			if (buffer) {
				// Rebuild per-point colors from the single Color trait when the parsed cloud has none.
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

				// Attributes must be reallocated when the point count changes, and an
				// entity can hold an attribute-less geometry: `parseMeshInput` returns
				// one for empty or truncated bytes.
				const oldCount = buffer.getAttribute('position')?.count ?? 0
				const newCount = parsed.positions.length / 3
				if (oldCount === newCount) {
					updateBufferGeometry(
						buffer,
						parsed.positions,
						{ colors, colorFormat: ColorFormat.RGB },
						parsed.bounds
					)
					// Replaces the tree built for the points this update just overwrote.
					if (parsed.boundsTree) attachPointsBvh(buffer, parsed.boundsTree)
				} else {
					const fresh = createBufferGeometry(
						parsed.positions,
						{ colors, colorFormat: ColorFormat.RGB },
						parsed.bounds
					)
					if (parsed.boundsTree) attachPointsBvh(fresh, parsed.boundsTree)
					buffer.dispose()
					entity.set(BufferGeometry, fresh)
				}

				return
			}

			entity.remove(Box, Capsule, Cylinder, Sphere)
			const geometry = createBufferGeometry(
				parsed.positions,
				{ colors: parsed.colors, colorFormat: ColorFormat.RGB },
				parsed.bounds
			)
			if (parsed.boundsTree) attachPointsBvh(geometry, parsed.boundsTree)
			entity.add(BufferGeometry(geometry))
			if (!entity.has(Points)) entity.add(Points)
		})
		.catch((error) => {
			console.error('Failed to update pointcloud buffer geometry:', error)
		})
}
