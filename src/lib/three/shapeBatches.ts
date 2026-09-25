import {
	BatchedMesh,
	BoxGeometry,
	type BufferGeometry,
	type Color,
	CylinderGeometry,
	EdgesGeometry,
	LineBasicMaterial,
	type Material,
	type Matrix4,
	SphereGeometry,
	Vector4,
} from 'three'

import { darkenColor } from '$lib/color'

import { createBatchedGeometryAllocator } from './addBatchedGeometry'
import { addBatchedInstance } from './addBatchedInstance'
import { toFacesBatchLayout } from './toFacesBatchLayout'

const UNIT_BOX = new BoxGeometry(1, 1, 1)
const UNIT_SPHERE = new SphereGeometry(1, 16, 12)

/** rdk's capsule and cylinder axis is Z. Three builds both around Y. */
const UNIT_TUBE = new CylinderGeometry(1, 1, 1, 16, 1, true).rotateX(Math.PI / 2)
const UNIT_CAPSULE_HEAD = new SphereGeometry(1, 16, 6, 0, Math.PI * 2, 0, Math.PI / 2).rotateX(
	Math.PI / 2
)
const UNIT_CAPPED_CYLINDER = new CylinderGeometry(1, 1, 1, 16, 1, false).rotateX(Math.PI / 2)

/**
 * Unit face geometry per primitive. Every instance references one of these and
 * sets its dimensions through the per-instance matrix scale, so resizing never
 * rebuilds GPU buffers. Each matches the geometry the former per-entity
 * renderer used, so the sphere is radius 1 at 16 × 12 segments.
 *
 * One open-ended tube serves both a capsule's body and an uncapped cylinder.
 * They were always the same shape, and now that the faces material is
 * `DoubleSide` nothing distinguishes them.
 */
const FACE_GEOMETRIES = {
	box: toFacesBatchLayout(UNIT_BOX),
	capsuleHead: toFacesBatchLayout(UNIT_CAPSULE_HEAD),
	cappedCylinder: toFacesBatchLayout(UNIT_CAPPED_CYLINDER),
	sphere: toFacesBatchLayout(UNIT_SPHERE),
	tube: toFacesBatchLayout(UNIT_TUBE),
}

export type Shape = keyof typeof FACE_GEOMETRIES

/**
 * Outlines are derived from the faces they wrap, so the two cannot drift apart.
 * `EdgesGeometry` already emits non-indexed `position` alone, which is the
 * layout the edges batch wants, so these need no further flattening.
 */
const EDGE_GEOMETRIES: Record<Shape, BufferGeometry> = {
	box: new EdgesGeometry(UNIT_BOX, 0),
	capsuleHead: new EdgesGeometry(UNIT_CAPSULE_HEAD, 0),
	cappedCylinder: new EdgesGeometry(UNIT_CAPPED_CYLINDER, 0),
	sphere: new EdgesGeometry(UNIT_SPHERE, 0),
	tube: new EdgesGeometry(UNIT_TUBE, 0),
}

const SHAPES = Object.keys(FACE_GEOMETRIES) as Shape[]

/** `addBatchedInstance` doubles past this, so it only sets how many arrive free. */
const INITIAL_INSTANCE_CAPACITY = 256

/** How much darker an outline is than the face it wraps, in percent. */
const EDGE_DARKEN = 10

const sumIndices = (geometries: BufferGeometry[]): number =>
	geometries.reduce((total, geometry) => total + (geometry.getIndex()?.count ?? 0), 0)

const sumVertices = (geometries: BufferGeometry[]): number =>
	geometries.reduce((total, geometry) => total + geometry.getAttribute('position').count, 0)

/** One primitive's slots. Faces and edges have independent free lists. */
export interface ShapeInstanceIds {
	readonly face: number
	readonly edge: number
}

/**
 * A mesh uploaded into the batches, shared by every entity drawing it. Field
 * names differ from `ShapeInstanceIds` on purpose: these index the geometry
 * buffer, not the instance list, and mixing the two is silent.
 */
export interface MeshSlot {
	readonly faceGeometry: number
	readonly edgeGeometry: number
}

export interface ShapeBatches {
	/** Pointer-interaction surface. A hit reports its instance as `batchId`. */
	readonly faces: BatchedMesh
	readonly edges: BatchedMesh
	add: (shape: Shape) => ShapeInstanceIds
	setMatrix: (ids: ShapeInstanceIds, matrix: Matrix4) => void
	setAppearance: (ids: ShapeInstanceIds, color: Color, opacity: number, visible: boolean) => void
	/** Repoints existing slots at a different shape, keeping their instance ids. */
	setShape: (ids: ShapeInstanceIds, shape: Shape) => void
	release: (ids: ShapeInstanceIds) => void

	/**
	 * Uploads an arbitrary mesh and its outline, so entities that are not one of
	 * the unit primitives can draw from the same batches and take part in the
	 * same per-instance sort. Registering the same geometry again returns the
	 * slot already uploaded.
	 */
	registerMesh: (geometry: BufferGeometry) => MeshSlot
	/** Drops one registration. The geometry leaves the buffer once none are left. */
	releaseMesh: (geometry: BufferGeometry) => void
	addMesh: (slot: MeshSlot) => ShapeInstanceIds
}

/**
 * Builds the two batches every renderer draws into: one for faces, one for the
 * outlines that wrap them.
 *
 * Everything transparent shares one faces batch, because three sorts transparent
 * objects against each other by their `matrixWorld` position and a batch is a
 * single object. Two batches would each sort as though they sat at the world
 * origin, and no material setting would let their instances interleave — which
 * is why a batched primitive could erase or draw over a separate mesh depending
 * on the angle. Inside one batch `sortObjects` orders every instance by its own
 * distance, every frame, from any angle.
 *
 * `facesMaterial` has to be `DoubleSide`. It is what lets one batch hold shapes
 * that cannot cull back faces, such as an uncapped cylinder, and it matches what
 * a translucent shell should look like: light crosses the near wall and the far
 * one.
 */
export const createShapeBatches = (facesMaterial: Material): ShapeBatches => {
	const faceGeometries = SHAPES.map((shape) => FACE_GEOMETRIES[shape])
	const edgeGeometries = SHAPES.map((shape) => EDGE_GEOMETRIES[shape])

	const initialFaceVertices = sumVertices(faceGeometries)
	const initialFaceIndices = sumIndices(faceGeometries)
	const initialEdgeVertices = sumVertices(edgeGeometries)

	const faces = new BatchedMesh(
		INITIAL_INSTANCE_CAPACITY,
		initialFaceVertices,
		initialFaceIndices,
		facesMaterial
	)
	faces.castShadow = true
	faces.receiveShadow = true

	/**
	 * `perObjectFrustumCulled` (on by default) does the culling, per instance and
	 * per frame. Whole-object culling has to stay off: three derives
	 * `boundingSphere` on the first frustum test, while the batch is still empty,
	 * and no mutator invalidates it, so the object would never draw again.
	 */
	faces.frustumCulled = false

	/**
	 * An outline fades with the face it wraps, so it carries the same
	 * per-instance alpha. That alpha only blends on a transparent material —
	 * unconditional here, matching the faces material, so edges and faces stay in
	 * one pass instead of being ordered against each other.
	 */
	const edges = new BatchedMesh(
		INITIAL_INSTANCE_CAPACITY,
		initialEdgeVertices,
		0,
		new LineBasicMaterial({ transparent: true })
	)
	edges.frustumCulled = false

	/** Outlines track the faces they wrap, so a second depth sort each frame buys nothing. */
	edges.sortObjects = false

	/**
	 * `BatchedMesh` extends `Mesh`, so on its own it would draw the edge geometry
	 * as triangles. Re-tagging the object makes the renderer emit `gl.LINES`: the
	 * draw mode comes from `isLine` / `isLineSegments`, and the multi-draw branch
	 * that follows it keys off `isBatchedMesh` independently.
	 */
	Object.assign(edges, { isMesh: false, isLine: true, isLineSegments: true })

	const allocateFaceGeometry = createBatchedGeometryAllocator(
		faces,
		initialFaceVertices,
		initialFaceIndices
	)
	const allocateEdgeGeometry = createBatchedGeometryAllocator(edges, initialEdgeVertices, 0)

	const faceGeometryIds = {} as Record<Shape, number>
	const edgeGeometryIds = {} as Record<Shape, number>
	for (const shape of SHAPES) {
		faceGeometryIds[shape] = allocateFaceGeometry(FACE_GEOMETRIES[shape])
		edgeGeometryIds[shape] = allocateEdgeGeometry(EDGE_GEOMETRIES[shape])
	}

	/** Registered meshes, keyed by source geometry so repeats share one upload. */
	const meshSlots = new Map<BufferGeometry, { slot: MeshSlot; users: number }>()

	const faceColor = new Vector4()
	const edgeColor = new Vector4()

	return {
		faces,
		edges,

		add: (shape) => ({
			face: addBatchedInstance(faces, faceGeometryIds[shape]),
			edge: addBatchedInstance(edges, edgeGeometryIds[shape]),
		}),

		setMatrix: (ids, matrix) => {
			faces.setMatrixAt(ids.face, matrix)
			edges.setMatrixAt(ids.edge, matrix)
		},

		setAppearance: (ids, color, opacity, visible) => {
			faces.setColorAt(ids.face, faceColor.set(color.r, color.g, color.b, opacity))
			faces.setVisibleAt(ids.face, visible)

			const outline = darkenColor(color, EDGE_DARKEN)
			edges.setColorAt(ids.edge, edgeColor.set(outline.r, outline.g, outline.b, opacity))
			edges.setVisibleAt(ids.edge, visible)
		},

		setShape: (ids, shape) => {
			faces.setGeometryIdAt(ids.face, faceGeometryIds[shape])
			edges.setGeometryIdAt(ids.edge, edgeGeometryIds[shape])
		},

		release: (ids) => {
			faces.deleteInstance(ids.face)
			edges.deleteInstance(ids.edge)
		},

		registerMesh: (geometry) => {
			const registered = meshSlots.get(geometry)
			if (registered) {
				registered.users += 1
				return registered.slot
			}

			const faceGeometry = toFacesBatchLayout(geometry)

			// Derived from the converged geometry, not the source: an out-of-range
			// index would otherwise reach `EdgesGeometry` unrepaired and put NaN
			// positions into the shared outline buffer, which takes the whole
			// batch's bounding sphere with it.
			const edgeGeometry = new EdgesGeometry(faceGeometry, 0)

			const slot = {
				faceGeometry: allocateFaceGeometry(faceGeometry),
				edgeGeometry: allocateEdgeGeometry(edgeGeometry),
			}

			// Both were copied into the batch buffers, so the staging copies are done.
			faceGeometry.dispose()
			edgeGeometry.dispose()

			meshSlots.set(geometry, { slot, users: 1 })
			return slot
		},

		releaseMesh: (geometry) => {
			const registered = meshSlots.get(geometry)
			if (registered === undefined) return

			registered.users -= 1
			if (registered.users > 0) return

			meshSlots.delete(geometry)
			faces.deleteGeometry(registered.slot.faceGeometry)
			edges.deleteGeometry(registered.slot.edgeGeometry)
		},

		addMesh: (slot) => ({
			face: addBatchedInstance(faces, slot.faceGeometry),
			edge: addBatchedInstance(edges, slot.edgeGeometry),
		}),
	}
}
