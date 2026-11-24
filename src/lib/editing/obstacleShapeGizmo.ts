import { Matrix4 } from 'three'

import type { PartComponent } from '#lib/hooks/usePartConfig.svelte.js'

import { Pose } from '#lib/math/index.js'
import { obstacleGeometriesOf } from '#lib/obstacleAttributes.js'
import { type ObstacleGeometryPatch, patchObstacleGeometries } from '#lib/obstacleGeometryList.js'

const tempInverse = new Matrix4()
const tempOffset = new Matrix4()

/**
 * A shape's offset from its obstacle's frame, in mm and degrees, given the world matrix of the
 * shape's own frame and where the gizmo has dragged the shape to. The shape frame sits at the
 * obstacle's origin, so its world matrix is the obstacle's.
 */
export const shapeOffsetFromGizmo = (shapeFrameWorld: Matrix4, gizmoWorld: Matrix4): Pose => {
	tempInverse.copy(shapeFrameWorld).invert()
	tempOffset.multiplyMatrices(tempInverse, gizmoWorld)
	return new Pose().setFromMatrix4(tempOffset)
}

/**
 * The obstacle's attributes with each patch applied to the shape at its index. Several shapes of
 * one obstacle move in one write, since a write per shape would each start from the same stale
 * config and undo the others.
 */
export const withObstacleShapePatches = (
	component: PartComponent,
	patches: ReadonlyMap<number, ObstacleGeometryPatch>
): Record<string, unknown> => ({
	...component.attributes,
	geometries: patchObstacleGeometries(obstacleGeometriesOf(component), patches),
})
