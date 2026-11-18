import type { Entity } from 'koota'
import type { BufferGeometry, Color, Matrix4, Object3D } from 'three'

import { getContext, setContext } from 'svelte'

import type { MeshSlot, Shape, ShapeBatches, ShapeInstanceIds } from '$lib/three/shapeBatches'

const SHAPE_BATCHES_CONTEXT_KEY = Symbol('shape-batches')

/**
 * The shared primitive batches, with each instance tied to the entity it draws.
 * `ShapeBatches` itself stays free of ECS types, so the entity bookkeeping
 * lives here instead.
 */
export interface EntityShapeBatches {
	add: (entity: Entity, shape: Shape) => ShapeInstanceIds
	setMatrix: (ids: ShapeInstanceIds, matrix: Matrix4) => void
	setAppearance: (ids: ShapeInstanceIds, color: Color, opacity: number, visible: boolean) => void
	setShape: (ids: ShapeInstanceIds, shape: Shape) => void
	release: (ids: ShapeInstanceIds) => void

	/** Uploads an arbitrary mesh, shared and refcounted across entities drawing it. */
	registerMesh: (geometry: BufferGeometry) => MeshSlot
	releaseMesh: (geometry: BufferGeometry) => void
	addMesh: (entity: Entity, slot: MeshSlot) => ShapeInstanceIds

	/** The entity a pointer hit landed on, given the faces batch hit and its `batchId`. */
	entityAt: (mesh: Object3D, batchId: number) => Entity | undefined
}

export const provideShapeBatches = (batches: ShapeBatches): EntityShapeBatches => {
	// Keyed by handle, not face id: ids repeat across passes and change when opacity moves a shape.
	const entityByHandle = new Map<ShapeInstanceIds, Entity>()

	const context: EntityShapeBatches = {
		add: (entity, shape) => {
			const ids = batches.add(shape)
			entityByHandle.set(ids, entity)
			return ids
		},
		setMatrix: batches.setMatrix,
		setAppearance: batches.setAppearance,
		setShape: batches.setShape,
		release: (ids) => {
			entityByHandle.delete(ids)
			batches.release(ids)
		},

		registerMesh: batches.registerMesh,
		releaseMesh: batches.releaseMesh,
		addMesh: (entity, slot) => {
			const ids = batches.addMesh(slot)
			entityByHandle.set(ids, entity)
			return ids
		},

		entityAt: (mesh, batchId) => {
			const ids = batches.instanceAt(mesh, batchId)
			return ids === undefined ? undefined : entityByHandle.get(ids)
		},
	}

	setContext(SHAPE_BATCHES_CONTEXT_KEY, context)

	return context
}

export const useShapeBatches = (): EntityShapeBatches =>
	getContext<EntityShapeBatches>(SHAPE_BATCHES_CONTEXT_KEY)
