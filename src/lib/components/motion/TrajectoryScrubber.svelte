<script lang="ts">
	import type { HTMLAttributes } from 'svelte/elements'

	import {
		ChevronLeft,
		ChevronRight,
		ChevronsLeft,
		ChevronsRight,
		Pause,
		Play,
	} from 'lucide-svelte'

	import type { TrajectoryPlayer } from '$lib/motion/trajectoryPlayer.svelte'

	interface Props extends HTMLAttributes<HTMLDivElement> {
		/** Playback state to drive. See `createTrajectoryPlayer`. */
		player: TrajectoryPlayer
		/** Distinguishes this scrubber's controls when more than one is on screen. */
		label?: string
		/**
		 * Frames that are real data rather than drawn between it, marked on the track. Must be
		 * ascending, deduplicated, and within `[0, player.lastStep]`. Omit when every frame is real.
		 */
		markers?: number[]
	}

	const { player, label = 'trajectory', markers, ...rest }: Props = $props()

	/**
	 * The thumb's diameter, handed to the style block as `--thumb-size`. The tick offsets correct for
	 * it, and two copies of the number would drift.
	 */
	const THUMB_PX = 12

	// The player outlives this component, so nothing else stops the timer when the controls go away.
	// Left running, it keeps reconciling the world every frame with no way on screen to pause it.
	$effect(() => {
		const running = player
		return () => running.pause()
	})

	const atStart = $derived(player.currentStep <= 0)

	const BUTTON_CLASS =
		'border-light text-subtle-1 focus-visible:ring-info-medium flex h-6 w-6 shrink-0 items-center justify-center rounded border focus-visible:ring-2 focus-visible:outline-none'
	const ENABLED_CLASS = 'hover:bg-light active:bg-medium'
	const DISABLED_CLASS = 'opacity-40'

	/**
	 * Where each mark sits along the track, as a fraction of the way from the first frame to the
	 * last. The pixel geometry is the `.tick` rule's problem, not this one's.
	 */
	const tickFractions = $derived.by(() => {
		// Also guards the divide: `lastStep` is 0 only with at most one step, which admits no marker.
		if (!markers || markers.length >= player.totalSteps) return []
		return markers.map((frame) => frame / player.lastStep)
	})

	const currentWaypoint = $derived.by(() => {
		// Same density rule as the ticks, and for the same reason: when every frame is a waypoint the
		// counter reads "4 / 12 · waypoint 4 / 12", saying one thing twice.
		if (!markers?.length || markers.length >= player.totalSteps) return undefined
		let passed = 0
		for (const frame of markers) {
			if (frame > player.currentStep) break
			passed += 1
		}
		return { index: passed, total: markers.length }
	})
</script>

{#if player.totalSteps > 0}
	<div
		class="border-light flex flex-col gap-2 border-t pt-2"
		{...rest}
	>
		<div
			class="relative"
			style="--thumb-size: {THUMB_PX}px"
		>
			<input
				class="scrubber w-full"
				type="range"
				min="0"
				max={player.lastStep}
				value={player.currentStep}
				aria-label="{label} step"
				oninput={(e) => {
					const input = e.currentTarget
					player.seek(Number(input.value))
					// Svelte writes `value` back only when the bound expression changes, so on a refused seek
					// nothing else moves the thumb off the index it was dragged to.
					input.value = String(player.currentStep)
				}}
			/>

			{#if tickFractions.length > 0}
				<!-- Purely informational, and the range input underneath owns the interaction. -->
				<div
					class="pointer-events-none absolute inset-x-0 top-0 h-1"
					aria-hidden="true"
				>
					{#each tickFractions as fraction, index (index)}
						<span
							class="tick bg-gray-8 absolute top-0 h-1 w-px"
							style="--tick-fraction: {fraction}"
							data-testid="waypoint-tick"
						></span>
					{/each}
				</div>
			{/if}
		</div>

		<div class="flex items-center gap-1">
			<!--
				`aria-disabled` rather than `disabled` so an end of the trajectory does not drop the
				control out of the tab order under a keyboard user mid-scrub. The click stays live, so
				each handler re-checks.
			-->
			<button
				type="button"
				class={[BUTTON_CLASS, atStart ? DISABLED_CLASS : ENABLED_CLASS]}
				onclick={() => !atStart && player.seek(0)}
				aria-disabled={atStart}
				aria-label="Jump to start of {label}"
				title="Jump to start"
				><ChevronsLeft
					size={12}
					aria-hidden="true"
				/></button
			>

			<button
				type="button"
				class={[BUTTON_CLASS, atStart ? DISABLED_CLASS : ENABLED_CLASS]}
				onclick={() => !atStart && player.stepBy(-1)}
				aria-disabled={atStart}
				aria-label="Previous {label} step"
				title="Previous step"
				><ChevronLeft
					size={12}
					aria-hidden="true"
				/></button
			>

			<button
				type="button"
				class={[BUTTON_CLASS, ENABLED_CLASS]}
				onclick={() => player.toggle()}
				aria-label={player.isPlaying ? `Pause ${label}` : `Play ${label}`}
				title={player.isPlaying ? 'Pause' : 'Play'}
				>{#if player.isPlaying}<Pause
						size={12}
						aria-hidden="true"
					/>{:else}<Play
						size={12}
						aria-hidden="true"
					/>{/if}</button
			>

			<button
				type="button"
				class={[BUTTON_CLASS, player.atEnd ? DISABLED_CLASS : ENABLED_CLASS]}
				onclick={() => !player.atEnd && player.stepBy(1)}
				aria-disabled={player.atEnd}
				aria-label="Next {label} step"
				title="Next step"
				><ChevronRight
					size={12}
					aria-hidden="true"
				/></button
			>

			<button
				type="button"
				class={[BUTTON_CLASS, player.atEnd ? DISABLED_CLASS : ENABLED_CLASS]}
				onclick={() => !player.atEnd && player.seek(player.lastStep)}
				aria-disabled={player.atEnd}
				aria-label="Jump to end of {label}"
				title="Jump to end"
				><ChevronsRight
					size={12}
					aria-hidden="true"
				/></button
			>

			<span class="text-subtle-1 font-roboto-mono ml-auto whitespace-nowrap tabular-nums">
				{player.currentStep + 1} / {player.totalSteps}
				{#if currentWaypoint}
					<span class="text-subtle-2">
						· waypoint {currentWaypoint.index} / {currentWaypoint.total}
					</span>
				{/if}
			</span>
		</div>
	</div>
{/if}

<style>
	/*
	 * A range input's track and thumb are reachable only through vendor pseudo-elements, which no
	 * utility class targets. The values are the theme tokens the utilities would resolve to.
	 */
	.scrubber {
		appearance: none;
		-webkit-appearance: none;
		height: 4px;
		border-radius: 2px;
		background: var(--color-gray-4);
		cursor: pointer;
	}
	.scrubber::-webkit-slider-thumb {
		-webkit-appearance: none;
		appearance: none;
		width: var(--thumb-size);
		height: var(--thumb-size);
		border-radius: 50%;
		background: var(--color-gray-8);
		border: none;
		cursor: pointer;
	}
	.scrubber::-moz-range-thumb {
		width: var(--thumb-size);
		height: var(--thumb-size);
		border-radius: 50%;
		background: var(--color-gray-8);
		border: none;
		cursor: pointer;
	}

	/*
	 * The thumb's center travels from half a thumb in to half a thumb short of the end, not the full
	 * width, so a mark at a bare percentage misses the frame it marks by up to half a thumb.
	 */
	.tick {
		left: calc(var(--tick-fraction) * (100% - var(--thumb-size)) + var(--thumb-size) / 2);
	}
</style>
