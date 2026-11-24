import type { Pose, PosePatch } from '#lib/math/index.js'
import type { ObstacleGeometryPatch } from '#lib/obstacleGeometryList.js'

/**
 * A shape's offset from its obstacle with `patch` applied. The whole offset is written, with the
 * orientation spelled as `ov_degrees`, so every edit leaves a shape in the same config shape.
 */
export const obstacleShapeOffsetPatch = (
	offset: Pose,
	patch: PosePatch
): ObstacleGeometryPatch => ({
	translation: { x: patch.x ?? offset.x, y: patch.y ?? offset.y, z: patch.z ?? offset.z },
	orientation: {
		type: 'ov_degrees',
		value: {
			x: patch.oX ?? offset.oX,
			y: patch.oY ?? offset.oY,
			z: patch.oZ ?? offset.oZ,
			th: patch.theta ?? offset.theta,
		},
	},
})
