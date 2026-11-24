import type { MotionClient } from '@viamrobotics/sdk'

import { untrack } from 'svelte'

import type { FramesContext } from '#lib/hooks/useFrames.svelte.js'
import type { Pose } from '#lib/math/index.js'
import type { TrajectoryPlayer } from '#lib/motion/trajectoryPlayer.svelte.js'
import type { TrajectoryStep } from '#lib/motion/trajectoryStep.js'

import { isAlreadyAtGoal, parsePlanResult, planCommand } from '#lib/motion/planDoCommand.js'

import type { MoveOptions } from './parseMoveOptions'

import { type PreviewDetail, useTrajectoryDrawing } from './useTrajectoryDrawing.svelte'

export { type PreviewDetail, previewFrameIntervalMs } from './useTrajectoryDrawing.svelte'

/**
 * `already-at-goal` is not `error`: RDK answered, and the trajectory it returned is the start
 * configuration written twice, the correct answer to "how do I get somewhere I already am".
 */
export type PreviewStatus = 'idle' | 'planning' | 'ready' | 'already-at-goal' | 'error'

export interface PreviewMoveOptions {
	frames: FramesContext
	client: () => MotionClient | undefined
	/** The motion service's resource name; the request names it, and only builtin answers. */
	service: () => string | undefined
	frameName: () => string
	/** The staged goal, or `undefined` while the gizmo still tracks the frame. */
	destination: () => { referenceFrame: string; pose: Pose } | undefined
	/**
	 * The same world state and constraints `executeMove` sends, so the preview plans the problem
	 * that would actually be executed. May throw on malformed JSON — read inside the request.
	 */
	moveOptions: () => MoveOptions
	/**
	 * Every input the plan was computed from, not just the goal: world state, constraints, service.
	 * A change to any discards the plan rather than leaving a stale answer on screen.
	 */
	invalidateOn: () => unknown
}

export interface PreviewMove {
	readonly status: PreviewStatus
	/**
	 * Why there is nothing to play, for whichever of `error` and `already-at-goal` we are in.
	 * `status` says how to present it; this says what happened.
	 */
	readonly message: string | undefined
	/**
	 * The trajectory exactly as planned, for handing back to `execute` — never `playbackFrames`, the
	 * separate array the scrubber actually walks. Empty unless `status` is `ready`.
	 */
	readonly trajectory: TrajectoryStep[]
	/** How many waypoints the planner actually returned, whatever is being played. */
	readonly plannedSteps: number
	/** Which played frames are planned waypoints, for marking them on a scrubber. */
	readonly waypointIndices: number[]
	/**
	 * Setting this rebuilds the played frames for the new framing and restarts playback at frame 0,
	 * because a frame index does not carry across the two framings. Setting the current value is a
	 * no-op.
	 */
	detail: PreviewDetail
	readonly player: TrajectoryPlayer
	/** Plans. Resolves once the answer is in hand; never rejects. */
	requestPreview: () => Promise<void>
	clear: () => void
}

/**
 * Ask the builtin motion service to plan a move without executing it, draw the answer, and drive a
 * scrubber with it. One instance per open move panel.
 */
export const usePreviewMove = ({
	frames,
	client,
	service,
	frameName,
	destination,
	moveOptions,
	invalidateOn,
}: PreviewMoveOptions): PreviewMove => {
	let status = $state<PreviewStatus>('idle')
	let message = $state<string>()

	const drawing = useTrajectoryDrawing({ onStepError: (reason) => fail(reason) })

	/**
	 * Which request the state on screen belongs to. Bumped by every reset, so a plan that resolves
	 * after the goal moved can tell that its answer is for a question nobody is asking any more.
	 */
	let generation = 0
	let inFlight: AbortController | undefined

	/**
	 * Drop everything a preview owns. The three callers (`clear`, `settle`, and the top of
	 * `requestPreview`) differ only in the `status` and `message` they leave behind.
	 */
	const resetPreview = () => {
		// Cancelled, not merely ignored: otherwise the request runs to completion on the machine, and
		// `generation` alone would let a resolved promise write over a preview the user has replaced.
		generation += 1
		inFlight?.abort()
		inFlight = undefined

		drawing.clear()
	}

	const clear = () => {
		resetPreview()
		message = undefined
		status = 'idle'
	}

	/** Drop the preview and say why. `status` is what decides how the panel presents it. */
	const settle = (next: 'already-at-goal' | 'error', reason: string) => {
		resetPreview()
		message = reason
		status = next
	}

	const fail = (reason: string) => settle('error', reason)

	const requestPreview = async () => {
		const motion = client()
		const serviceName = service()
		const goal = destination()
		// Leaves `status` where it was rather than routing through `fail()`: nothing failed, the caller
		// is missing a client, a service or a goal, and is relied on to gate the action on all three.
		if (!motion || !serviceName || !goal) return

		// The reply lands in `trajectory`, so drop the old preview up front rather than leaving a stale
		// plan on screen if this throws.
		resetPreview()
		message = undefined
		status = 'planning'

		const attempt = new AbortController()
		inFlight = attempt
		const mine = generation

		try {
			const { worldState, constraints } = moveOptions()
			// Read with the rest of the inputs, not after the await: `useFrames` refetches on every
			// config revision, and kinematics the plan was not computed against misplace every twin.
			const parts = frames.parts
			const response = await motion.doCommand(
				planCommand({
					service: serviceName,
					componentName: frameName(),
					destination: goal,
					worldState,
					constraints,
				}),
				{ signal: attempt.signal }
			)

			// `clear()` cannot reach into an awaited promise, and it leaves `status` at `idle`, so
			// without this the panel would go from nothing pending to offering an abandoned goal.
			if (mine !== generation) return

			const result = parsePlanResult(response)
			if (isAlreadyAtGoal(result.trajectory)) {
				settle('already-at-goal', `"${frameName()}" is already at the target.`)
				return
			}

			// Built from `frameSystemConfig` rather than a plan dump: the `plan` reply carries joint
			// values only, and this is the only path a browser has to the kinematics behind them.
			const failure = drawing.draw(result.trajectory, parts)
			if (failure) {
				fail(failure)
				return
			}

			status = 'ready'
		} catch (error_) {
			// An abandoned request's failure is not the user's problem, and an aborted one reports a
			// cancellation they did not ask about.
			if (mine !== generation) return
			fail(error_ instanceof Error ? error_.message : `Failed to plan a move for "${frameName()}".`)
		}
	}

	// A staged goal that moves invalidates the plan made for the previous one. `untrack` so clearing
	// state this effect does not read cannot re-enter it.
	$effect(() => {
		invalidateOn()
		untrack(() => {
			if (status !== 'idle') clear()
		})
	})

	// `$effect` cleanup rather than `onDestroy`: it is the same teardown, and it does not need a
	// component around it, which is what lets a spec drive this hook.
	$effect(() => () => {
		generation += 1
		inFlight?.abort()
	})

	return {
		get status() {
			return status
		},
		get message() {
			return message
		},
		get trajectory() {
			return drawing.trajectory
		},
		get plannedSteps() {
			return drawing.trajectory.length
		},
		get waypointIndices() {
			return drawing.waypointIndices
		},
		get detail() {
			return drawing.detail
		},
		set detail(next: PreviewDetail) {
			drawing.detail = next
		},
		get player() {
			return drawing.player
		},
		requestPreview,
		clear,
	}
}
