import type { MoveTarget } from './MoveTarget'

export interface MoveTargetGizmoProps {
	/**
	 * The component whose end effector the gizmo drives, by the bare name `MotionClient.move` takes,
	 * such as `arm-1`.
	 */
	frame: string

	/**
	 * The staged goal. Bindable. `undefined` means nothing is staged, and the handle tracks the live
	 * end effector. A drag writes the new goal here. A value the host writes while the user is
	 * dragging does not move the handle out from under the pointer.
	 */
	target?: MoveTarget

	/**
	 * Hides the handles and ignores input. A drag in progress when this turns on ends, and the camera
	 * controls are released.
	 */
	disabled?: boolean

	/** Whether the handles move or turn the target. Defaults to `'translate'`. */
	mode?: 'translate' | 'rotate'

	/** Whether the handles align with the world axes or the target's own. Defaults to `'world'`. */
	space?: 'local' | 'world'

	/** Called with the new goal on every pointer move of a drag. */
	onDrag?: (target: MoveTarget) => void

	/** Called once with the final goal when a drag ends on pointer up. */
	onRelease?: (target: MoveTarget) => void
}
