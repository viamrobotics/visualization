import type { FramesContext } from '#lib/hooks/useFrames.svelte.js'
import type { FrameDescriptor } from '#lib/motion/frameDescriptors.js'
import type { JointMotions } from '#lib/motion/interpolateTrajectory.js'
import type { TrajectoryStep } from '#lib/motion/jointPose.js'
import type { TrajectoryPlayer } from '#lib/motion/trajectoryPlayer.svelte.js'

import { traits, useWorld } from '#lib/ecs/index.js'
import { buildFrameDescriptors } from '#lib/motion/frameDescriptors.js'
import { frameSystemToPlanFrames } from '#lib/motion/frameSystemToPlanFrames.js'
import {
	interpolatedFrames,
	jointMotionsOf,
	waypointFrames,
} from '#lib/motion/interpolateTrajectory.js'
import { createTrajectoryPlayer } from '#lib/motion/trajectoryPlayer.svelte.js'
import { applyInputs } from '#lib/posedFrames.js'

import {
	clearPreviewGhosts,
	createPreviewGhosts,
	type PreviewGhosts,
	spawnPreviewGhosts,
} from './previewGhosts'

/**
 * What one frame of playback represents: `waypoints` gives each configuration the planner returned
 * its own frame, `interpolated` fills in along the straight joint path RDK collision-checks.
 */
export type PreviewDetail = 'waypoints' | 'interpolated'

/**
 * How long a preview aims to take, once it has frames enough to fill the time. A sparse plan
 * finishes sooner instead of stretching, because pacing two waypoints to four seconds reads as
 * nothing happening rather than as a slow move.
 */
const PREVIEW_DURATION_MS = 4000

/** Faster than this is wasted on a display. Very dense plans run longer than the target instead. */
const MIN_FRAME_MS = 16

/**
 * The longest a single frame holds. A waypoint plan is a handful of discrete configurations, and
 * without a ceiling the duration target parks a two-waypoint plan on one frame for the whole four
 * seconds.
 */
const MAX_FRAME_MS = 250

/**
 * How long each frame holds, for a plan of `frameCount` frames. Clamped at both ends: below
 * {@link MIN_FRAME_MS} a dense plan only flickers, and above {@link MAX_FRAME_MS} a sparse one
 * stops reading as motion at all.
 *
 * Playback covers `frameCount - 1` transitions, so that is what the duration divides.
 */
export const previewFrameIntervalMs = (frameCount: number): number =>
	Math.min(MAX_FRAME_MS, Math.max(MIN_FRAME_MS, PREVIEW_DURATION_MS / Math.max(1, frameCount - 1)))

export interface TrajectoryDrawingOptions {
	/** Called with the message when drawing a step throws. */
	onStepError: (message: string) => void
}

export interface TrajectoryDrawing {
	/** What is drawn, `[]` when nothing is. */
	readonly trajectory: TrajectoryStep[]
	/** Which played frames are planned waypoints, for marking them on a scrubber. */
	readonly waypointIndices: number[]
	/**
	 * Setting this rebuilds the played frames for the new framing and restarts playback at frame 0,
	 * because a frame index does not carry across the two framings. Setting the current value is a
	 * no-op.
	 */
	detail: PreviewDetail
	readonly player: TrajectoryPlayer
	/**
	 * Replaces whatever is drawn.
	 *
	 * @returns Why nothing could be drawn, leaving nothing drawn, or `undefined` on success.
	 */
	draw: (trajectory: TrajectoryStep[], parts: FramesContext['parts']) => string | undefined
	/** Removes the drawing and resets the player. */
	clear: () => void
}

/**
 * Draws a trajectory as ghosts of the frame system and drives a player over it. Ghosts are cleared
 * when the owning component unmounts.
 */
export const useTrajectoryDrawing = ({
	onStepError,
}: TrajectoryDrawingOptions): TrajectoryDrawing => {
	const world = useWorld()

	// Raw: all three are replaced wholesale rather than mutated, so the deep proxy would go unused,
	// `waypointIndices` included, since the scrubber reads it element-wise but never writes into it.
	let trajectory = $state.raw<TrajectoryStep[]>([])
	// What the scrubber walks. Only `trajectory` is the plan as given.
	let playbackFrames = $state.raw<TrajectoryStep[]>([])
	let waypointIndices = $state.raw<number[]>([])
	let detail = $state<PreviewDetail>('waypoints')

	// Outside `$state`: koota entities and Three.js matrices want no deep proxy. `const` because
	// `spawnPreviewGhosts` fills it in place, keeping it the only handle teardown has.
	const ghosts: PreviewGhosts = createPreviewGhosts()

	// `useGhostModels` attaches a twin's model as it spawns, so this is current right after a draw.
	const drawsAnyModel = () => ghosts.entities.some((entity) => entity.has(traits.Model))

	// Held alongside the ghosts rather than derived where it is used: `set detail` reframes the same
	// plan without a descriptor in scope, and it needs the same answer `draw` built.
	let jointMotions: JointMotions = new Map()

	const frameIntervalMs = $derived(previewFrameIntervalMs(playbackFrames.length))

	/** Reports whether the step was drawn; see `TrajectoryPlayerOptions.onStep`. */
	const renderStep = (step: number): boolean => {
		const inputs = playbackFrames[step]
		if (!inputs) return false
		try {
			applyInputs(ghosts.joints, inputs)
		} catch (error) {
			onStepError(error instanceof Error ? error.message : 'Failed to draw a step of the plan.')
			return false
		}
		return true
	}

	/** Rebuild the played frames for the current detail. The plan itself is untouched. */
	const applyDetail = (planned: TrajectoryStep[]) => {
		const built =
			detail === 'waypoints'
				? waypointFrames(planned)
				: interpolatedFrames(planned, { motions: jointMotions })
		playbackFrames = built.steps
		waypointIndices = built.waypoints
	}

	const player = createTrajectoryPlayer({
		totalSteps: () => playbackFrames.length,
		onStep: renderStep,
		intervalMs: () => frameIntervalMs,
	})

	const clear = () => {
		clearPreviewGhosts(ghosts)
		jointMotions = new Map()
		trajectory = []
		playbackFrames = []
		waypointIndices = []
		player.reset()
	}

	const draw = (planned: TrajectoryStep[], parts: FramesContext['parts']): string | undefined => {
		clear()

		// Built from `frameSystemConfig` rather than a plan dump: the `plan` reply carries joint
		// values only, and this is the only path a browser has to the kinematics behind them.
		const descriptors: FrameDescriptor[] = buildFrameDescriptors(frameSystemToPlanFrames(parts))
		if (descriptors.length === 0) {
			return 'No frame system available to draw the plan against.'
		}

		// The trajectory decides which frames earn a twin, not just where they go: RDK returns a
		// column for every component, so the ones it holds still have to be told apart from the ones
		// it moves.
		jointMotions = jointMotionsOf(descriptors)
		// Spawning poses every twin at the first step, so a joint that cannot be posed throws here.
		// The twins spawned before it would otherwise outlive the failed draw.
		try {
			spawnPreviewGhosts(world, descriptors, planned, ghosts)
		} catch (error) {
			clear()
			return error instanceof Error ? error.message : 'Failed to draw the plan.'
		}

		// Joints and geometry-less mounts make up most of a chain, so counting entities here would
		// arm the panel over a preview with nothing on screen. A twin with no collider still draws
		// when its link has a 3D model on screen.
		if (ghosts.drawn === 0 && !drawsAnyModel()) {
			clear()
			return 'No geometry in the frame system to draw this plan with.'
		}

		trajectory = planned
		applyDetail(planned)
		return undefined
	}

	// `$effect` cleanup rather than `onDestroy`: it is the same teardown, and it does not need a
	// component around it, which is what lets a spec drive this hook.
	$effect(() => () => {
		clearPreviewGhosts(ghosts)
	})

	return {
		get trajectory() {
			return trajectory
		},
		get waypointIndices() {
			return waypointIndices
		},
		get detail() {
			return detail
		},
		set detail(next: PreviewDetail) {
			if (next === detail) return
			detail = next
			if (trajectory.length === 0) return
			applyDetail(trajectory)
			player.reset()
			renderStep(0)
		},
		player,
		draw,
		clear,
	}
}
