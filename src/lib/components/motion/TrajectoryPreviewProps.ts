import type { TrajectoryStep } from '#lib/motion/jointPose.js'

export interface TrajectoryPreviewProps {
	/**
	 * The steps to draw, as `parsePlanResult(reply).trajectory` returns them from the builtin motion
	 * service's `plan` reply. Each step maps a component name to its joint values. `undefined` draws
	 * nothing.
	 */
	trajectory: TrajectoryStep[] | undefined

	/** The step on screen. Bindable. Playback advances it, and a write from the host seeks to it. */
	step?: number

	/** Whether the preview plays, looping back to the first step after the last. Defaults to `true`. */
	playing?: boolean

	/**
	 * What one step of playback represents. `'waypoints'` gives each configuration the planner
	 * returned its own step. `'interpolated'` fills in along the straight joint path between them.
	 * Defaults to `'waypoints'`.
	 */
	detail?: 'waypoints' | 'interpolated'

	/**
	 * Called with a reason the preview cannot draw, such as no frame system loaded or no geometry to
	 * draw with, and with an error thrown while drawing a step. Omit it and the scene drops those
	 * messages.
	 */
	onError?: (message: string) => void
}
