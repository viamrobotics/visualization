import type { Matrix4, Quaternion, Ray, Vector2, Vector3 } from 'three'

import type { DragConstraint } from './dragConstraint'
import type { SnapShape } from './snapShape'

/** A geometry the drag can snap to. */
export interface SnapTarget {
	shape: SnapShape
	/** The geometry's local-to-world transform, without scale. */
	matrix: Matrix4
}

/** One geometry that moves with the drag, placed relative to the gizmo. */
export interface DraggedGeometry {
	shape: SnapShape
	/** The geometry's transform relative to the gizmo anchor. */
	anchorToGeometry: Matrix4
}

/** One pointer move of a translate drag. */
export interface SnapQuery {
	/** Where the gizmo put the anchor, before any object snap. */
	position: Vector3
	/** The anchor's orientation when the drag began. */
	orientation: Quaternion
	/**
	 * The geometries that move with the drag: the entity's own and its descendants'. Empty for a
	 * frame with none, which snaps by its origin alone.
	 */
	dragged: DraggedGeometry[]
	targets: SnapTarget[]
	constraint: DragConstraint
	/** The world-space ray under the cursor. */
	ray: Ray
	/** The cursor, in canvas pixels. */
	cursor: Vector2
	/**
	 * Projects a world point to canvas pixels into `out`. Returns `false` for a point behind the
	 * camera.
	 */
	toScreen: (point: Vector3, out: Vector2) => boolean
	/** Sets `out` to the camera's ray through the pixel `point` projects to. */
	rayThrough: (point: Vector3, out: Ray) => Ray
	groundPlane: boolean
	alignRotation: boolean
}

/** What the scene draws to show where a snap landed. */
export type SnapIndicator =
	| { kind: 'point'; point: Vector3 }
	| { kind: 'surface'; point: Vector3; normal: Vector3 }

/** A snapped anchor pose. */
export interface SnapResult {
	position: Vector3
	orientation: Quaternion
	indicator: SnapIndicator
}
