import { afterEach, describe, expect, it, vi } from 'vitest'

import type { TrajectoryPlayer } from '../trajectoryPlayer.svelte'

import {
	createTrajectoryPlayerHarness,
	type TrajectoryPlayerHarness,
} from './__fixtures__/trajectoryPlayerHarness.svelte'

const INTERVAL_MS = 100

let harness: TrajectoryPlayerHarness | undefined

const setup = (totalSteps = 3) => {
	harness = createTrajectoryPlayerHarness({ totalSteps, intervalMs: INTERVAL_MS })
	return harness
}

afterEach(() => {
	harness?.dispose()
	harness = undefined
	vi.useRealTimers()
})

describe('createTrajectoryPlayer', () => {
	it('starts parked at the first step, having reported nothing', () => {
		const { player, steps } = setup()

		expect(player.currentStep).toBe(0)
		expect(player.totalSteps).toBe(3)
		expect(player.lastStep).toBe(2)
		expect(player.isPlaying).toBe(false)
		expect(steps).toEqual([])
	})

	it('reports every index it moves to', () => {
		const { player, steps } = setup()

		player.seek(2)

		expect(player.currentStep).toBe(2)
		expect(steps).toEqual([2])
	})

	it.each([
		[9, 2],
		[-4, 0],
	])('clamps a seek to %i into range', (requested, expected) => {
		const { player, steps } = setup()

		player.seek(requested)

		expect(player.currentStep).toBe(expected)
		expect(steps).toEqual([expected])
	})

	it('refuses a non-finite seek instead of latching onto NaN', () => {
		const { player, steps } = setup()

		player.seek(2)
		player.seek(Number.NaN)

		expect(player.currentStep).toBe(2)
		expect(steps).toEqual([2])
	})

	it('truncates a fractional seek to the whole step below it', () => {
		const { player, steps } = setup()

		player.seek(1.5)

		expect(player.currentStep).toBe(1)
		expect(steps).toEqual([1])
	})

	it('steps relative to the current index, clamped at the ends', () => {
		const { player } = setup()

		player.stepBy(1)
		player.stepBy(1)
		expect(player.currentStep).toBe(2)

		player.stepBy(1)
		expect(player.currentStep).toBe(2)

		player.stepBy(-1)
		expect(player.currentStep).toBe(1)
	})

	it('advances on the interval and stops itself at the last step', () => {
		vi.useFakeTimers()
		const { player, steps, flush } = setup()

		player.play()
		flush()
		expect(player.isPlaying).toBe(true)

		vi.advanceTimersByTime(INTERVAL_MS * 2)
		expect(steps).toEqual([1, 2])
		expect(player.atEnd).toBe(true)

		vi.advanceTimersByTime(INTERVAL_MS)
		flush()
		expect(player.isPlaying).toBe(false)
		expect(steps).toEqual([1, 2])
	})

	it('re-paces a run in flight when the caller changes the interval', () => {
		vi.useFakeTimers()
		const { player, steps, setIntervalMs, flush } = setup(5)

		player.play()
		flush()
		vi.advanceTimersByTime(100)
		expect(steps).toEqual([1])

		setIntervalMs(10)
		vi.advanceTimersByTime(30)

		expect(steps).toEqual([1, 2, 3, 4])
	})

	it('rewinds before playing again when parked at the end', () => {
		const { player, steps, flush } = setup()

		player.seek(2)
		steps.length = 0

		player.toggle()
		flush()

		expect(player.currentStep).toBe(0)
		expect(steps).toEqual([0])
		expect(player.isPlaying).toBe(true)
	})

	it.each([
		['seek', (player: TrajectoryPlayer) => player.seek(1)],
		['stepBy', (player: TrajectoryPlayer) => player.stepBy(1)],
		['toggle', (player: TrajectoryPlayer) => player.toggle()],
	])('pauses when the user drives it with %s', (_label, drive) => {
		const { player, flush } = setup()

		player.play()
		flush()
		drive(player)
		flush()

		expect(player.isPlaying).toBe(false)
	})

	it('does nothing at all with no steps to play', () => {
		const { player, steps } = setup(0)

		player.play()
		// Asserted before the seek below rather than after it: `seek` pauses on its way through, which
		// would stand in for the guard inside `play` and hide its absence.
		expect(player.isPlaying).toBe(false)

		player.seek(1)

		expect(player.isPlaying).toBe(false)
		expect(player.currentStep).toBe(0)
		// Not -1: `lastStep` is what a scrubber hands its range input as `max`, and a negative one
		// there inverts the track.
		expect(player.lastStep).toBe(0)
		expect(steps).toEqual([])
	})

	it('parks and rewinds when the steps are unloaded mid-playback', () => {
		const { player, steps, setTotalSteps, flush } = setup()

		player.seek(2)
		player.play()
		flush()

		setTotalSteps(0)

		expect(player.isPlaying).toBe(false)
		expect(player.currentStep).toBe(0)
		// Rewinding here must not re-render a step that no longer exists.
		expect(steps).toEqual([2])
	})

	describe('a step the consumer refuses', () => {
		it('leaves the index on the frame that is still on screen', () => {
			const { player, setRenderable } = setup(5)

			player.seek(1)
			setRenderable((step) => step !== 3)
			player.seek(3)

			expect(player.currentStep).toBe(1)
		})

		it('still counts the next relative step from where it actually is', () => {
			const { player, steps, setRenderable } = setup(5)

			player.seek(1)
			setRenderable((step) => step !== 2)
			player.stepBy(1)
			expect(player.currentStep).toBe(1)

			setRenderable(() => true)
			player.stepBy(1)

			expect(player.currentStep).toBe(2)
			expect(steps).toEqual([1, 2, 2])
		})

		it('parks playback instead of retrying the same index every tick', () => {
			vi.useFakeTimers()
			const { player, steps, setRenderable, flush } = setup(10)

			setRenderable((step) => step < 3)
			player.play()
			flush()

			vi.advanceTimersByTime(INTERVAL_MS * 5)
			flush()

			expect(player.isPlaying).toBe(false)
			expect(steps).toEqual([1, 2, 3])
			expect(player.currentStep).toBe(2)
		})
	})

	it('rewinds silently on reset, for a caller that renders step 0 itself', () => {
		const { player, steps, flush } = setup()

		player.seek(2)
		player.play()
		flush()
		steps.length = 0

		player.reset()
		flush()

		expect(player.currentStep).toBe(0)
		expect(player.isPlaying).toBe(false)
		expect(steps).toEqual([])
	})
})
