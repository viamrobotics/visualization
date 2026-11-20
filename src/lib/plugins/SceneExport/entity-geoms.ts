import type { Entity } from 'koota'

import {
	type BufferGeometry,
	Color,
	type Material,
	Matrix4,
	type Mesh,
	type Object3D,
	Vector3,
} from 'three'

import { traits } from '#lib/ecs/index.js'
import { Pose } from '#lib/math/index.js'

import type { SimExportNote, SimGeom, SimShape } from './sim-scene'

import { entityRgba, toSimRgba } from './entity-rgba'
import { tubeMesh } from './tube-mesh'

const MM_TO_M = 0.001

const centerPose = new Pose()
const materialColor = new Color()

const centerOf = (entity: Entity): Matrix4 => {
	const center = entity.get(traits.Center)
	return center ? centerPose.copy(center).toMatrix4() : new Matrix4()
}

/** Empty or truncated mesh bytes parse to a geometry with no vertices, which STL cannot hold. */
const hasVertices = (geometry: BufferGeometry): boolean =>
	(geometry.getAttribute('position')?.count ?? 0) > 0

const colliderShape = (entity: Entity, notes: SimExportNote[]): SimShape | undefined => {
	const box = entity.get(traits.Box)
	if (box) {
		return {
			kind: 'box',
			size: new Vector3(box.x, box.y, box.z).multiplyScalar(MM_TO_M),
		}
	}

	const sphere = entity.get(traits.Sphere)
	if (sphere) return { kind: 'sphere', radius: sphere.r * MM_TO_M }

	const capsule = entity.get(traits.Capsule)
	if (capsule) {
		return { kind: 'capsule', radius: capsule.r * MM_TO_M, length: capsule.l * MM_TO_M }
	}

	const cylinder = entity.get(traits.Cylinder)
	if (cylinder) {
		const radius = cylinder.r * MM_TO_M
		const length = cylinder.l * MM_TO_M
		return cylinder.capped
			? { kind: 'cylinder', radius, length }
			: { kind: 'mesh', geometry: tubeMesh(radius, length) }
	}

	const geometry = entity.get(traits.BufferGeometry)
	if (!geometry) return undefined
	if (!hasVertices(geometry)) {
		notes.push({ reason: 'mesh-empty-skipped', subject: entity.get(traits.Name) ?? '' })
		return undefined
	}
	return { kind: 'mesh', geometry: geometry.clone() }
}

const WHITE = 0xffffff

const isMesh = (object: Object3D): object is Mesh => (object as Mesh).isMesh === true

/** The material's own color, or white for one that has none, as glTF's default material is. */
const meshRgba = (mesh: Mesh): [number, number, number, number] => {
	const material: Material | undefined = Array.isArray(mesh.material)
		? mesh.material[0]
		: mesh.material
	const color = (material as { color?: Color } | undefined)?.color
	if (color?.isColor) materialColor.copy(color)
	else materialColor.set(WHITE)
	return toSimRgba(materialColor, material?.opacity ?? 1)
}

/**
 * Where a visual model's root sits in its entity's frame. A draw-API GLTF keeps its own root
 * transform, as `GLTF.svelte` draws it. An arm model's root takes the entity's `Center` instead, as
 * `GeometryModel` draws it.
 */
const modelRootPlacement = (entity: Entity, model: Object3D): Matrix4 => {
	if (!entity.has(traits.GLTF)) return centerOf(entity)
	model.updateMatrix()
	return model.matrix.clone()
}

/**
 * One visual geom per mesh in `model`, with each mesh's transform baked into its vertices. A mesh
 * with no vertices draws nothing in the scene either, so it is left out.
 */
const visualModelGeoms = (model: Object3D, rootPlacement: Matrix4): SimGeom[] => {
	model.updateMatrixWorld(true)
	const rootInverse = model.matrixWorld.clone().invert()
	const geoms: SimGeom[] = []

	model.traverse((object) => {
		if (!isMesh(object) || !hasVertices(object.geometry)) return
		const toBody = rootPlacement.clone().multiply(rootInverse).multiply(object.matrixWorld)
		geoms.push({
			shape: { kind: 'mesh', geometry: object.geometry.clone().applyMatrix4(toBody) },
			origin: new Matrix4(),
			rgba: meshRgba(object),
			role: 'visual',
		})
	})

	return geoms
}

/**
 * The geoms `entity` contributes to its body. With a `visualModel`, the model's meshes are the
 * visuals and the Viam geometry collides alone. Without one, the Viam geometry is both.
 */
export const entityGeoms = (
	entity: Entity,
	visualModel: Object3D | undefined,
	notes: SimExportNote[]
): SimGeom[] => {
	const center = centerOf(entity)
	const geoms = visualModel
		? visualModelGeoms(visualModel, modelRootPlacement(entity, visualModel))
		: []
	const shape = colliderShape(entity, notes)

	if (visualModel && !shape) {
		notes.push({ reason: 'model-visual-only', subject: entity.get(traits.Name) ?? '' })
	}

	if (shape) {
		if (shape.kind === 'mesh') shape.geometry.applyMatrix4(center)
		geoms.push({
			shape,
			origin: shape.kind === 'mesh' ? new Matrix4() : center,
			rgba: entityRgba(entity),
			role: visualModel ? 'collision' : 'visual-and-collision',
		})
	}

	return geoms
}
