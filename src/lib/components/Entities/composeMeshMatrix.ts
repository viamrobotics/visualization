import type { Entity } from 'koota'

import { Matrix4, Vector3 } from 'three'

import { traits } from '$lib/ecs'
import { Pose } from '$lib/math'

const tempPose = new Pose()
const centerMatrix = new Matrix4()
const boundsCenter = new Vector3()
const boundsSize = new Vector3()

/**
 * Compose a mesh entity's render transform into `out`: `WorldMatrix × Center
 * pose`. The geometry carries its own dimensions, so unlike the primitives
 * there is no scale term.
 *
 * Returns `false` (leaving `out` untouched) when the entity is missing the
 * traits needed to place a mesh.
 */
export const composeMeshMatrix = (entity: Entity, out: Matrix4): boolean => {
	const worldMatrix = entity.get(traits.WorldMatrix)

	if (!worldMatrix) {
		return false
	}

	out.copy(worldMatrix)

	const center = entity.get(traits.Center)
	if (center) {
		out.multiply(tempPose.copy(center).toMatrix4(centerMatrix))
	}

	return true
}

/**
 * Compose a mesh entity's selection-bounds transform into `out`: the render
 * transform, then the offset and scale that map a unit box (±0.5) onto the
 * geometry's own bounding box.
 *
 * Mesh entities render through the shared batches, so they have no named scene
 * object for `scene.getObjectByName` to measure. Their geometry is the
 * authority instead, and mapping it onto a unit box lets the overlays treat
 * them exactly like the primitives.
 *
 * Returns `false` (leaving `out` untouched) when the entity has no geometry to
 * measure, which includes one that parsed to nothing.
 */
export const composeMeshBoundsMatrix = (entity: Entity, out: Matrix4): boolean => {
	const geometry = entity.get(traits.BufferGeometry)

	if (!geometry || (geometry.getAttribute('position')?.count ?? 0) === 0) {
		return false
	}

	if (geometry.boundingBox === null) {
		geometry.computeBoundingBox()
	}

	const bounds = geometry.boundingBox
	if (bounds === null || !composeMeshMatrix(entity, out)) {
		return false
	}

	bounds.getCenter(boundsCenter)
	bounds.getSize(boundsSize)

	out.multiply(centerMatrix.makeTranslation(boundsCenter.x, boundsCenter.y, boundsCenter.z))
	out.scale(boundsSize)

	return true
}
