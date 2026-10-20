/**
 * Runes only compile in a `.svelte.ts` file, so the reactive scaffolding lives here and the
 * assertions stay in the spec.
 */

import { flushSync } from 'svelte'

import type { TrajectoryPlayer } from '../../trajectoryPlayer.svelte'

import { createTrajectoryPlayer } from '../../trajectoryPlayer.svelte'

export interface TrajectoryPlayerHarness {
	player: TrajectoryPlayer
	/** Every index the player reported through `onStep`, in order, refused ones included. */
	steps: number[]
	/** Change the step count the player reads, as loading or unloading a plan would. */
	setTotalSteps: (total: number) => void
	/** Re-pace playback, as a caller would on switching to a differently-paced frame source. */
	setIntervalMs: (ms: number) => void
	/**
	 * Decide which steps `onStep` accepts, standing in for a consumer whose snapshots or kinematics
	 * are missing for some of them. Everything is accepted until this is called.
	 */
	setRenderable: (predicate: (step: number) => boolean) => void
	/** Flush pending effects, so a timer started or stopped this tick is actually running. */
	flush: () => void
	dispose: () => void
}

export const createTrajectoryPlayerHarness = (options: {
	totalSteps: number
	intervalMs: number
}): TrajectoryPlayerHarness => {
	let total = $state(options.totalSteps)
	// Reactive: a plain variable would never re-run the timer's effect.
	let pace = $state(options.intervalMs)
	// Plain, not `$state`: the player reads it inside `onStep`, never as a dependency.
	let renderable: (step: number) => boolean = () => true
	const steps: number[] = []

	let player!: TrajectoryPlayer
	const dispose = $effect.root(() => {
		player = createTrajectoryPlayer({
			totalSteps: () => total,
			onStep: (step) => {
				steps.push(step)
				return renderable(step)
			},
			intervalMs: () => pace,
		})
	})

	flushSync()

	return {
		player,
		steps,
		setTotalSteps: (next) => {
			total = next
			flushSync()
		},
		setIntervalMs: (ms) => {
			pace = ms
			flushSync()
		},
		setRenderable: (predicate) => {
			renderable = predicate
		},
		flush: flushSync,
		dispose,
	}
}
