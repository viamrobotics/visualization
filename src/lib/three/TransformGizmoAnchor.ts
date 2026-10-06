import { Group, type Matrix4 } from 'three'

/**
 * The object a transform gizmo drags in place of a selected frame, which renders no scene
 * object of its own to attach to. It mounts at the scene root and follows the frame's world
 * matrix.
 *
 * It keeps `matrixAutoUpdate` on. TransformControls snaps a world-space drag by reading
 * `getWorldPosition()`, which sees a new `position` only once the matrix is recomposed from
 * it. With auto-update off, every snapped drag reads its starting position and lands back
 * there.
 */
export class TransformGizmoAnchor extends Group {
	/** Places the anchor at `world` and syncs the position, rotation and scale the gizmo reads. */
	syncTo(world: Matrix4): void {
		world.decompose(this.position, this.quaternion, this.scale)
		this.updateMatrixWorld()
	}
}
