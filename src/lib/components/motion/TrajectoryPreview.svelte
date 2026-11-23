<!--
@component

A planned trajectory drawn as ghosts of the frame system and played on a loop, with no DOM of its
own. Render it as a child of `ScopedScene`. It never calls the motion service: the host plans, turns
the reply into steps with `parsePlanResult`, and passes them as `trajectory`. `undefined` draws
nothing.
-->
<script lang="ts">
	import { untrack } from 'svelte'

	import { useTrajectoryDrawing } from '#lib/components/motion/useTrajectoryDrawing.svelte.js'
	import { useFrames } from '#lib/hooks/useFrames.svelte.js'

	import type { TrajectoryPreviewProps } from './TrajectoryPreviewProps'

	let {
		trajectory,
		step = $bindable(0),
		playing = true,
		detail = 'waypoints',
		onError,
	}: TrajectoryPreviewProps = $props()

	/** Read at call time, so a host swapping its callback never redraws the preview. */
	const report = (message: string) => onError?.(message)

	/**
	 * Set when a step fails to draw, so playback parks on it instead of retrying it every interval and
	 * reporting the same error each time. Cleared by the next draw.
	 */
	let isStalled = $state(false)

	/** One step is a still pose. Looping it would only replay the same frame. */
	const MIN_STEPS_TO_LOOP = 2

	const frames = useFrames()
	const drawing = useTrajectoryDrawing({
		onStepError: (message) => {
			isStalled = true
			report(message)
		},
	})
	const { player } = drawing

	// Before the draw below, so the first draw already builds the host's framing.
	$effect.pre(() => {
		drawing.detail = detail
	})

	$effect(() => {
		const planned = trajectory
		const parts = frames.parts
		const isLoadingFrames = frames.isLoadingMachineFrames

		untrack(() => {
			isStalled = false

			if (!planned) {
				drawing.clear()
				return
			}

			// Waits rather than reporting a missing frame system that is still on its way. This effect
			// re-runs when it lands.
			if (parts.length === 0 && isLoadingFrames) {
				drawing.clear()
				return
			}

			const failure = drawing.draw(planned, parts)
			if (failure) {
				report(failure)
				return
			}

			// A paused host has picked the step it wants on screen. A playing one restarts from the top.
			if (!playing && step !== 0) player.seek(step)
		})
	})

	// Playback out to the host.
	$effect(() => {
		const current = player.currentStep
		untrack(() => {
			if (player.totalSteps > 0 && step !== current) step = current
		})
	})

	// A host write in to playback.
	$effect(() => {
		const wanted = step
		untrack(() => {
			if (player.totalSteps === 0 || wanted === player.currentStep) return
			player.seek(wanted)
			// A clamped or refused seek leaves the player elsewhere, and `step` says what is on screen.
			if (step !== player.currentStep) step = player.currentStep
		})
	})

	// The player parks at the last step. Looping is this component's job.
	$effect(() => {
		if (!playing || isStalled || player.totalSteps < MIN_STEPS_TO_LOOP) {
			untrack(() => player.pause())
			return
		}
		if (player.isPlaying) return

		untrack(() => {
			if (player.atEnd) player.seek(0)
			if (!isStalled) player.play()
		})
	})
</script>
