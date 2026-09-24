import type { Entity } from 'koota'

import { Box3, Matrix4, type Object3D, Vector3 } from 'three'

import { traits } from '$lib/ecs'
import { expandBoxByTransformedBox } from '$lib/three/OBBHelper'

import { composeBoxMatrix } from './composeBoxMatrix'
import { composeCapsuleBoundsMatrix } from './composeCapsuleMatrices'
import { composeCylinderBoundsMatrix } from './composeCylinderMatrix'
import { composeSphereBoundsMatrix } from './composeSphereMatrix'

const matrix4 = new Matrix4()
const unitBox = new Box3(new Vector3(-0.5, -0.5, -0.5), new Vector3(0.5, 0.5, 0.5))

/**
 * Geometry-less frames have no bounds, so they fall back to a small cube at the frame
 * origin, roughly the extent of the frame axes helper.
 */
const referenceFrameScale = new Vector3(0.1, 0.1, 0.1)

/**
 * Expand `box` (world space) by an entity's bounds, resolving them the same way
 * the selection overlays do — because `scene.getObjectByName` alone misses two
 * common frame kinds:
 *  - instanced primitives (box/sphere/capsule/cylinder) carry no named object, so
 *    compose the bounds straight from their traits,
 *  - geometry-less reference frames render only an axes helper, so mark a small
 *    cube at their `WorldMatrix` origin.
 * A named scene object (meshes, points, lines) contributes its own geometry.
 */
export const expandBoxByEntity = (box: Box3, entity: Entity, scene: Object3D): void => {
	if (
		composeBoxMatrix(entity, matrix4) ||
		composeCapsuleBoundsMatrix(entity, matrix4) ||
		composeCylinderBoundsMatrix(entity, matrix4) ||
		composeSphereBoundsMatrix(entity, matrix4)
	) {
		expandBoxByTransformedBox(box, unitBox, matrix4)
		return
	}

	const object3d = scene.getObjectByName(entity as unknown as string)
	if (object3d) {
		box.expandByObject(object3d)
		return
	}

	const world = entity.get(traits.WorldMatrix)
	if (world) {
		matrix4.copy(world).scale(referenceFrameScale)
		expandBoxByTransformedBox(box, unitBox, matrix4)
	}
}
