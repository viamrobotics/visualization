/**
 * Playback state for anything indexed by a discrete trajectory step. The consumer keeps the steps
 * themselves; this decides which index is current and when it advances, then reports it.
 */

export interface TrajectoryPlayerOptions {
	/** Read live rather than passed by value: the step count changes as plans load and unload. */
	totalSteps: () => number
	/**
	 * Called with every index this player moves to, playback's included. Return `false` to refuse:
	 * `currentStep` stays put, and playback parks rather than retrying the same index forever.
	 */
	onStep: (step: number) => boolean | void
	/**
	 * Milliseconds per frame, read live so a caller can hold playback to a fixed wall-clock duration
	 * as its frame count changes. Trajectory steps carry no duration of their own.
	 */
	intervalMs?: () => number
}

export interface TrajectoryPlayer {
	readonly currentStep: number
	readonly totalSteps: number
	readonly lastStep: number
	readonly isPlaying: boolean
	readonly atEnd: boolean
	play: () => void
	pause: () => void
	/** Play, rewinding first when parked at the end so the button never looks inert. */
	toggle: () => void
	/** Pause, then move to `step` clamped into range. */
	seek: (step: number) => void
	/** Pause, then move by `delta` steps clamped into range. */
	stepBy: (delta: number) => void
	/**
	 * Pause and return to step 0 without calling `onStep`, for a consumer that is loading new steps
	 * and will render index 0 itself as part of that load.
	 */
	reset: () => void
}

const DEFAULT_INTERVAL_MS = 100

/**
 * Must be called where `$effect` is legal, since the timer lives in one. From a click handler, from
 * module scope, or after an `await`, this throws `effect_orphan`.
 */
export const createTrajectoryPlayer = ({
	totalSteps,
	onStep,
	intervalMs = () => DEFAULT_INTERVAL_MS,
}: TrajectoryPlayerOptions): TrajectoryPlayer => {
	let currentStep = $state(0)
	let isPlaying = $state(false)

	const total = $derived(totalSteps())
	const lastStep = $derived(Math.max(0, total - 1))
	const atEnd = $derived(currentStep >= lastStep)

	/** Reports whether the move happened, which is what tells playback to stop. */
	const moveTo = (step: number): boolean => {
		if (total <= 0) return false
		// The clamp below does not catch this: `Math.min`/`Math.max` pass NaN straight through, since
		// every comparison against it is false. `seek` is public API, so NaN can reach here.
		if (!Number.isFinite(step)) return false
		const next = Math.max(0, Math.min(lastStep, Math.trunc(step)))

		// Committed after the render, not before: the index answers "what is on screen", so a consumer
		// that could not draw this step leaves it pointing at the one that is.
		if (onStep(next) === false) return false
		currentStep = next
		return true
	}

	const pause = () => {
		isPlaying = false
	}

	const play = () => {
		if (total <= 0) return
		isPlaying = true
	}

	// `currentStep` is read from a plain closure, not tracked, so this subscribes to `isPlaying` and
	// the pace alone and the timer survives a whole run instead of restarting once per step.
	$effect(() => {
		if (!isPlaying) return
		const pace = intervalMs()

		const intervalId = setInterval(() => {
			// `pause()` alone only takes the timer down once this effect re-runs. Nothing about
			// `setInterval` promises a checkpoint between callbacks, so clear it here instead.
			const park = () => {
				pause()
				clearInterval(intervalId)
			}

			if (currentStep >= lastStep) {
				park()
				return
			}
			if (!moveTo(currentStep + 1)) park()
		}, pace)

		return () => clearInterval(intervalId)
	})

	// Written from an effect because `isPlaying` and `currentStep` have independent writers. A
	// consumer that unloads its steps without `reset()` would leave a timer walking an empty range.
	$effect(() => {
		if (total > 0) return
		isPlaying = false
		currentStep = 0
	})

	return {
		get currentStep() {
			return currentStep
		},
		get totalSteps() {
			return total
		},
		get lastStep() {
			return lastStep
		},
		get isPlaying() {
			return isPlaying
		},
		get atEnd() {
			return atEnd
		},
		play,
		pause,
		toggle: () => {
			if (isPlaying) {
				pause()
				return
			}
			if (atEnd) moveTo(0)
			play()
		},
		seek: (step: number) => {
			pause()
			moveTo(step)
		},
		stepBy: (delta: number) => {
			pause()
			moveTo(currentStep + delta)
		},
		reset: () => {
			isPlaying = false
			currentStep = 0
		},
	}
}
