import { Matrix4 } from 'three'

import type { PartComponent } from '$lib/hooks/usePartConfig.svelte'

import { Pose } from '$lib/math'
import { obstacleGeometriesOf } from '$lib/obstacleAttributes'
import { type ObstacleGeometryPatch, patchObstacleGeometry } from '$lib/obstacleGeometryList'

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

/** The obstacle's attributes with `patch` applied to the shape at `index`. */
export const withObstacleShapePatch = (
	component: PartComponent,
	index: number,
	patch: ObstacleGeometryPatch
): Record<string, unknown> => ({
	...component.attributes,
	geometries: patchObstacleGeometry(obstacleGeometriesOf(component), index, patch),
})
