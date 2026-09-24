import type { Entity } from 'koota'
import type { BufferGeometry, Color, Matrix4 } from 'three'

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

	/** The entity a pointer hit landed on, given the hit's `batchId`. */
	entityAt: (faceId: number) => Entity | undefined
}

export const provideShapeBatches = (batches: ShapeBatches): EntityShapeBatches => {
	const entityByFaceId = new Map<number, Entity>()

	const context: EntityShapeBatches = {
		add: (entity, shape) => {
			const ids = batches.add(shape)
			entityByFaceId.set(ids.face, entity)
			return ids
		},
		setMatrix: batches.setMatrix,
		setAppearance: batches.setAppearance,
		setShape: batches.setShape,
		release: (ids) => {
			entityByFaceId.delete(ids.face)
			batches.release(ids)
		},

		registerMesh: batches.registerMesh,
		releaseMesh: batches.releaseMesh,
		addMesh: (entity, slot) => {
			const ids = batches.addMesh(slot)
			entityByFaceId.set(ids.face, entity)
			return ids
		},

		entityAt: (faceId) => entityByFaceId.get(faceId),
	}

	setContext(SHAPE_BATCHES_CONTEXT_KEY, context)

	return context
}

export const useShapeBatches = (): EntityShapeBatches =>
	getContext<EntityShapeBatches>(SHAPE_BATCHES_CONTEXT_KEY)
