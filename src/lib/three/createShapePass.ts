import {
	BatchedMesh,
	type BufferGeometry,
	DoubleSide,
	LineBasicMaterial,
	type Material,
	type MaterialParameters,
} from 'three'

import { createBatchedGeometryAllocator } from './addBatchedGeometry'
import { addBatchedInstance } from './addBatchedInstance'

/** Which render pass a shape draws in. Opacity below 1 is translucent. */
export type ShapePassName = 'opaque' | 'translucent'

/** A geometry's ids in one pass's buffers. Each pass has its own, so the ids differ between passes. */
export interface GeometryPair {
	readonly faceGeometry: number
	readonly edgeGeometry: number
}

/** One shape's instance slots in one pass. Faces and edges have independent free lists. */
export interface InstancePair {
	readonly face: number
	readonly edge: number
}

/** How many vertices and indices each batch arrives with, before any growth. */
export interface ShapePassCapacity {
	readonly faceVertices: number
	readonly faceIndices: number
	readonly edgeVertices: number
}

/** `addBatchedInstance` doubles past this, so it only sets how many arrive free. */
const INITIAL_INSTANCE_CAPACITY = 256

/**
 * Face material options per pass.
 *
 * `DoubleSide` is what lets one batch hold shapes that cannot cull back faces, such as
 * an uncapped cylinder, and it is what a translucent shell should look like: light
 * crosses the near wall and the far one. Per-instance alpha lives in the `w` of the
 * instance color, so the base color stays white and is never tinted.
 *
 * Translucent faces do not write depth, so overlapping translucent shapes blend instead
 * of the nearer-sorted one hiding the other.
 */
const FACE_PARAMETERS: Record<ShapePassName, MaterialParameters> = {
	opaque: { side: DoubleSide, vertexColors: true },
	translucent: { side: DoubleSide, vertexColors: true, transparent: true, depthWrite: false },
}

const createFacesBatch = (
	material: Material,
	capacity: ShapePassCapacity,
	isTranslucent: boolean
): BatchedMesh => {
	const faces = new BatchedMesh(
		INITIAL_INSTANCE_CAPACITY,
		capacity.faceVertices,
		capacity.faceIndices,
		material
	)
	faces.castShadow = true
	faces.receiveShadow = true
	faces.sortObjects = isTranslucent

	/**
	 * `perObjectFrustumCulled` (on by default) does the culling, per instance and
	 * per frame. Whole-object culling has to stay off: three derives
	 * `boundingSphere` on the first frustum test, while the batch is still empty,
	 * and no mutator invalidates it, so the object would never draw again.
	 */
	faces.frustumCulled = false

	return faces
}

/**
 * An outline fades with the face it wraps, so it carries the same per-instance alpha.
 *
 * Translucent outlines write no depth, so both walls of the shell blend over them as
 * they do over the rest of the face, and the outline reads darker than the face.
 */
const createEdgesBatch = (capacity: ShapePassCapacity, isTranslucent: boolean): BatchedMesh => {
	const edges = new BatchedMesh(
		INITIAL_INSTANCE_CAPACITY,
		capacity.edgeVertices,
		0,
		new LineBasicMaterial({ transparent: isTranslucent, depthWrite: !isTranslucent })
	)
	edges.frustumCulled = false
	edges.sortObjects = isTranslucent

	/**
	 * `BatchedMesh` extends `Mesh`, so on its own it would draw the edge geometry
	 * as triangles. Re-tagging the object makes the renderer emit `gl.LINES`: the
	 * draw mode comes from `isLine` / `isLineSegments`, and the multi-draw branch
	 * that follows it keys off `isBatchedMesh` independently.
	 */
	Object.assign(edges, { isMesh: false, isLine: true, isLineSegments: true })

	return edges
}

export interface ShapePass {
	/** Pointer-interaction surface. A hit reports its instance as `batchId`. */
	readonly faces: BatchedMesh
	readonly edges: BatchedMesh
	/** The options every face material for this pass is built from, including after a render mode swap. */
	readonly faceParameters: MaterialParameters
	/** Uploads a face geometry and its outline into this pass's buffers. */
	allocate: (faceGeometry: BufferGeometry, edgeGeometry: BufferGeometry) => GeometryPair
	deleteGeometry: (geometry: GeometryPair) => void
	addInstance: (geometry: GeometryPair) => InstancePair
	deleteInstance: (instance: InstancePair) => void
}

/**
 * Builds one render pass's faces batch and the outlines batch that wraps it.
 *
 * Both opaque batches draw in instance order rather than three's front-to-back sort.
 * Opaque surfaces rely on the depth buffer, so their order only settles exact depth
 * ties, and a distance sort would make the winner of a tie depend on the camera.
 * Translucent batches keep three's back-to-front sort, which blending needs.
 *
 * Both batches sit at the origin, so three draws them in object id order, which is
 * creation order. Opaque outlines are created after their faces, so they draw later and
 * win the depth tie against their own face's triangles. Translucent outlines are created
 * first: translucent faces write no depth, so an outline drawn after them would land on
 * top of every one, while drawn before, a face in front blends over it.
 */
export const createShapePass = (
	name: ShapePassName,
	createFacesMaterial: (parameters: MaterialParameters) => Material,
	capacity: ShapePassCapacity
): ShapePass => {
	const isTranslucent = name === 'translucent'
	const faceParameters = FACE_PARAMETERS[name]

	let faces: BatchedMesh
	let edges: BatchedMesh
	if (isTranslucent) {
		edges = createEdgesBatch(capacity, isTranslucent)
		faces = createFacesBatch(createFacesMaterial(faceParameters), capacity, isTranslucent)
	} else {
		faces = createFacesBatch(createFacesMaterial(faceParameters), capacity, isTranslucent)
		edges = createEdgesBatch(capacity, isTranslucent)
	}

	const allocateFaceGeometry = createBatchedGeometryAllocator(
		faces,
		capacity.faceVertices,
		capacity.faceIndices
	)
	const allocateEdgeGeometry = createBatchedGeometryAllocator(edges, capacity.edgeVertices, 0)

	return {
		faces,
		edges,
		faceParameters,

		allocate: (faceGeometry, edgeGeometry) => ({
			faceGeometry: allocateFaceGeometry(faceGeometry),
			edgeGeometry: allocateEdgeGeometry(edgeGeometry),
		}),

		deleteGeometry: (geometry) => {
			faces.deleteGeometry(geometry.faceGeometry)
			edges.deleteGeometry(geometry.edgeGeometry)
		},

		addInstance: (geometry) => ({
			face: addBatchedInstance(faces, geometry.faceGeometry),
			edge: addBatchedInstance(edges, geometry.edgeGeometry),
		}),

		deleteInstance: (instance) => {
			faces.deleteInstance(instance.face)
			edges.deleteInstance(instance.edge)
		},
	}
}
