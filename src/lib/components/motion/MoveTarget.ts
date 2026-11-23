import type { Pose } from '@viamrobotics/sdk'

/**
 * A goal for the frame a `MoveTargetGizmo` drives, in the shape the builtin motion service's `plan`
 * verb takes as its destination and `MotionClient.move` takes as its pose.
 *
 * The pose is in millimeters, with an orientation vector whose `theta` is in degrees, and it is
 * always expressed in `world`.
 */
export interface MoveTarget {
	referenceFrame: 'world'
	pose: Pose
}
