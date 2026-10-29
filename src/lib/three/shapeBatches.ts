import {
	BoxGeometry,
	type BufferGeometry,
	type Color,
	CylinderGeometry,
	EdgesGeometry,
	type Material,
	type MaterialParameters,
	Matrix4,
	type Object3D,
	SphereGeometry,
	Vector4,
} from 'three'

import { darkenColor } from '$lib/color'

import {
	createShapePass,
	type GeometryPair,
	type ShapePass,
	type ShapePassName,
} from './createShapePass'
import { setBatchedColorAt } from './setBatchedColorAt'
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

const PASS_NAMES: readonly ShapePassName[] = ['opaque', 'translucent']

/** How much darker an outline is than the face it wraps, in percent. */
const EDGE_DARKEN = 10

const sumIndices = (geometries: BufferGeometry[]): number =>
	geometries.reduce((total, geometry) => total + (geometry.getIndex()?.count ?? 0), 0)

const sumVertices = (geometries: BufferGeometry[]): number =>
	geometries.reduce((total, geometry) => total + geometry.getAttribute('position').count, 0)

const movedMatrix = new Matrix4()
const faceColor = new Vector4()
const edgeColor = new Vector4()

/**
 * A geometry uploaded into both passes, shared by every instance drawing it. Field
 * names differ from `ShapeInstanceIds` on purpose: these index the geometry buffers,
 * not the instance lists, and mixing the two is silent.
 */
export type MeshSlot = Readonly<Record<ShapePassName, GeometryPair>>

/**
 * One shape's handle. The batches own every field and rewrite them when opacity moves
 * the shape between passes, so a caller keeps the same handle for the shape's lifetime
 * and never writes to it.
 */
export interface ShapeInstanceIds {
	pass: ShapePassName
	face: number
	edge: number
	geometry: MeshSlot
}

/** The scene objects one pass draws with. */
export type ShapePassMeshes = Pick<ShapePass, 'faces' | 'edges' | 'faceParameters'>

export interface ShapeBatches {
	readonly opaque: ShapePassMeshes
	readonly translucent: ShapePassMeshes
	add: (shape: Shape) => ShapeInstanceIds
	setMatrix: (ids: ShapeInstanceIds, matrix: Matrix4) => void
	/** Also moves the shape to the pass its opacity belongs in. */
	setAppearance: (ids: ShapeInstanceIds, color: Color, opacity: number, visible: boolean) => void
	/** Repoints existing slots at a different shape, keeping their instance ids. */
	setShape: (ids: ShapeInstanceIds, shape: Shape) => void
	release: (ids: ShapeInstanceIds) => void

	/**
	 * Uploads an arbitrary mesh and its outline, so entities that are not one of
	 * the unit primitives can draw from the same batches. Registering the same
	 * geometry again returns the slot already uploaded.
	 */
	registerMesh: (geometry: BufferGeometry) => MeshSlot
	/** Drops one registration. The geometry leaves the buffers once none are left. */
	releaseMesh: (geometry: BufferGeometry) => void
	addMesh: (slot: MeshSlot) => ShapeInstanceIds

	/** The live shape behind a pointer hit, given the faces batch hit and its `batchId`. */
	instanceAt: (mesh: Object3D, batchId: number) => ShapeInstanceIds | undefined
}

/**
 * Builds the batches every primitive renderer draws into: an opaque pass and a
 * translucent pass, each with a faces batch and the outlines that wrap it.
 *
 * Opaque shapes draw in three's opaque pass and rely on the depth buffer. Every
 * translucent shape shares one faces batch, because three sorts transparent objects
 * against each other by their `matrixWorld` position and a batch is a single object.
 * Two translucent batches would each sort as though they sat at the world origin, and
 * no material setting would let their instances interleave. Inside one batch
 * `sortObjects` orders every instance by its own distance, every frame.
 *
 * Every geometry is uploaded into both passes, so a shape whose opacity crosses 1 can
 * move between them without a fresh upload.
 *
 * @param createFacesMaterial Builds a face material from the pass's options. Each pass
 * calls it once, with options that must survive any later rebuild of the material.
 */
export const createShapeBatches = (
	createFacesMaterial: (parameters: MaterialParameters) => Material
): ShapeBatches => {
	const faceGeometries = SHAPES.map((shape) => FACE_GEOMETRIES[shape])
	const edgeGeometries = SHAPES.map((shape) => EDGE_GEOMETRIES[shape])

	const capacity = {
		faceVertices: sumVertices(faceGeometries),
		faceIndices: sumIndices(faceGeometries),
		edgeVertices: sumVertices(edgeGeometries),
	}

	const passes: Record<ShapePassName, ShapePass> = {
		opaque: createShapePass('opaque', createFacesMaterial, capacity),
		translucent: createShapePass('translucent', createFacesMaterial, capacity),
	}

	/** Live handles per pass, indexed by face instance id, so a pointer hit resolves to its shape. */
	const handlesByPass: Record<ShapePassName, (ShapeInstanceIds | undefined)[]> = {
		opaque: [],
		translucent: [],
	}

	const allocate = (faceGeometry: BufferGeometry, edgeGeometry: BufferGeometry): MeshSlot => ({
		opaque: passes.opaque.allocate(faceGeometry, edgeGeometry),
		translucent: passes.translucent.allocate(faceGeometry, edgeGeometry),
	})

	const shapeSlots = {} as Record<Shape, MeshSlot>
	for (const shape of SHAPES) {
		shapeSlots[shape] = allocate(FACE_GEOMETRIES[shape], EDGE_GEOMETRIES[shape])
	}

	/** Registered meshes, keyed by source geometry so repeats share one upload. */
	const meshSlots = new Map<BufferGeometry, { slot: MeshSlot; users: number }>()

	const place = (handle: ShapeInstanceIds, pass: ShapePassName) => {
		const instance = passes[pass].addInstance(handle.geometry[pass])
		handle.pass = pass
		handle.face = instance.face
		handle.edge = instance.edge
		handlesByPass[pass][instance.face] = handle
	}

	const remove = (handle: ShapeInstanceIds) => {
		passes[handle.pass].deleteInstance(handle)
		handlesByPass[handle.pass][handle.face] = undefined
	}

	const addInstance = (geometry: MeshSlot): ShapeInstanceIds => {
		const handle: ShapeInstanceIds = { pass: 'opaque', face: -1, edge: -1, geometry }
		place(handle, 'opaque')
		return handle
	}

	/** Color and visibility are not carried, because `setAppearance` writes both right after. */
	const moveToPass = (handle: ShapeInstanceIds, pass: ShapePassName) => {
		passes[handle.pass].faces.getMatrixAt(handle.face, movedMatrix)
		remove(handle)
		place(handle, pass)
		passes[pass].faces.setMatrixAt(handle.face, movedMatrix)
		passes[pass].edges.setMatrixAt(handle.edge, movedMatrix)
	}

	return {
		opaque: passes.opaque,
		translucent: passes.translucent,

		add: (shape) => addInstance(shapeSlots[shape]),

		setMatrix: (ids, matrix) => {
			const { faces, edges } = passes[ids.pass]
			faces.setMatrixAt(ids.face, matrix)
			edges.setMatrixAt(ids.edge, matrix)
		},

		setAppearance: (ids, color, opacity, visible) => {
			const pass = opacity < 1 ? 'translucent' : 'opaque'
			if (pass !== ids.pass) {
				moveToPass(ids, pass)
			}

			const { faces, edges } = passes[pass]

			setBatchedColorAt(faces, ids.face, faceColor.set(color.r, color.g, color.b, opacity))
			faces.setVisibleAt(ids.face, visible)

			const outline = darkenColor(color, EDGE_DARKEN)
			setBatchedColorAt(edges, ids.edge, edgeColor.set(outline.r, outline.g, outline.b, opacity))
			edges.setVisibleAt(ids.edge, visible)
		},

		setShape: (ids, shape) => {
			ids.geometry = shapeSlots[shape]

			const { faces, edges } = passes[ids.pass]
			const geometry = ids.geometry[ids.pass]
			faces.setGeometryIdAt(ids.face, geometry.faceGeometry)
			edges.setGeometryIdAt(ids.edge, geometry.edgeGeometry)
		},

		release: remove,

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

			const slot = allocate(faceGeometry, edgeGeometry)

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
			for (const pass of PASS_NAMES) {
				passes[pass].deleteGeometry(registered.slot[pass])
			}
		},

		addMesh: addInstance,

		instanceAt: (mesh, batchId) => {
			const pass = PASS_NAMES.find((name) => passes[name].faces === mesh)
			return pass === undefined ? undefined : handlesByPass[pass][batchId]
		},
	}
}
