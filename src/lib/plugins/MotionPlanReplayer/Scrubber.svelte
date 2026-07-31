<script lang="ts">
	import {
		ChevronLeft,
		ChevronRight,
		ChevronsLeft,
		ChevronsRight,
		Pause,
		Play,
	} from 'lucide-svelte'

	interface Props {
		currentStep: number
		totalSteps: number
		onseek: (index: number) => void
		/** Step worth landing on exactly, marked with a tick on the track. */
		markIndex?: number | null
		markLabel?: string
	}

	const { currentStep, totalSteps, onseek, markIndex = null, markLabel = '' }: Props = $props()

	const STEP_INTERVAL_MS = 100

	let isPlaying = $state(false)

	const lastStepIdx = $derived(Math.max(0, totalSteps - 1))
	const atEnd = $derived(currentStep >= lastStepIdx)

	// Offset by half the thumb so the tick lines up with the thumb's centre rather than its left edge.
	const markOffset = $derived(
		markIndex === null || lastStepIdx === 0
			? null
			: `calc(6px + ${(markIndex / lastStepIdx) * 100}% - ${(markIndex / lastStepIdx) * 12}px)`
	)

	const pause = () => {
		isPlaying = false
	}

	const play = () => {
		if (totalSteps <= 0) return
		isPlaying = true
	}

	const togglePlay = () => {
		if (isPlaying) {
			pause()
			return
		}
		if (atEnd && totalSteps > 0) onseek(0)
		play()
	}

	const seek = (index: number) => {
		pause()
		onseek(index)
	}

	const stepOnce = (direction: 'prev' | 'next') => {
		pause()
		onseek(direction === 'next' ? currentStep + 1 : currentStep - 1)
	}

	$effect(() => {
		if (!isPlaying) return

		const intervalId = setInterval(() => {
			if (currentStep >= lastStepIdx) {
				pause()
				return
			}
			onseek(currentStep + 1)
		}, STEP_INTERVAL_MS)

		return () => clearInterval(intervalId)
	})

	$effect(() => {
		if (totalSteps <= 0 && isPlaying) pause()
	})
</script>

{#if totalSteps > 0}
	<div class="border-light flex flex-col gap-2 border-t pt-2">
		<div class="relative">
			<input
				class="scrubber w-full"
				type="range"
				min="0"
				max={lastStepIdx}
				value={currentStep}
				oninput={(e) => seek(Number((e.currentTarget as HTMLInputElement).value))}
			/>
			{#if markOffset}
				<span
					class="bg-warning-dark pointer-events-none absolute top-1/2 h-2.5 w-0.5 -translate-y-1/2 rounded-full"
					style:left={markOffset}
					aria-hidden="true"
				></span>
			{/if}
		</div>

		<div class="flex items-center gap-1">
			<button
				type="button"
				class="border-light text-subtle-1 hover:bg-light flex h-6 w-6 shrink-0 items-center justify-center rounded border disabled:opacity-40"
				onclick={() => seek(0)}
				disabled={currentStep <= 0}
				aria-label="Jump to start"
				title="Jump to start"><ChevronsLeft size={12} /></button
			>

			<button
				type="button"
				class="border-light text-subtle-1 hover:bg-light flex h-6 w-6 shrink-0 items-center justify-center rounded border disabled:opacity-40"
				onclick={() => stepOnce('prev')}
				disabled={currentStep <= 0}
				aria-label="Previous step"
				title="Previous step"><ChevronLeft size={12} /></button
			>

			<button
				type="button"
				class="border-light text-subtle-1 hover:bg-light flex h-6 w-6 shrink-0 items-center justify-center rounded border"
				onclick={togglePlay}
				aria-label={isPlaying ? 'Pause' : 'Play'}
				title={isPlaying ? 'Pause' : 'Play'}
				>{#if isPlaying}<Pause size={12} />{:else}<Play size={12} />{/if}</button
			>

			<button
				type="button"
				class="border-light text-subtle-1 hover:bg-light flex h-6 w-6 shrink-0 items-center justify-center rounded border disabled:opacity-40"
				onclick={() => stepOnce('next')}
				disabled={atEnd}
				aria-label="Next step"
				title="Next step"><ChevronRight size={12} /></button
			>

			<button
				type="button"
				class="border-light text-subtle-1 hover:bg-light flex h-6 w-6 shrink-0 items-center justify-center rounded border disabled:opacity-40"
				onclick={() => seek(lastStepIdx)}
				disabled={atEnd}
				aria-label="Jump to end"
				title="Jump to end"><ChevronsRight size={12} /></button
			>

			<span class="text-subtle-1 font-roboto-mono ml-auto whitespace-nowrap tabular-nums">
				{#if markLabel && currentStep === markIndex}
					<span class="text-warning-dark">{markLabel}</span>
				{/if}
				{currentStep + 1} / {totalSteps}
			</span>
		</div>
	</div>
{/if}

<style>
	.scrubber {
		appearance: none;
		-webkit-appearance: none;
		height: 4px;
		border-radius: 2px;
		background: var(--color-gray-4, #d7d7d9);
		cursor: pointer;
	}
	.scrubber::-webkit-slider-thumb {
		-webkit-appearance: none;
		appearance: none;
		width: 12px;
		height: 12px;
		border-radius: 50%;
		background: var(--color-gray-8, #333438);
		border: none;
		cursor: pointer;
	}
	.scrubber::-moz-range-thumb {
		width: 12px;
		height: 12px;
		border-radius: 50%;
		background: var(--color-gray-8, #333438);
		border: none;
		cursor: pointer;
	}
</style>
