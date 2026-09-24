<script lang="ts">
	import { Banner, BannerVariant, Button, ToggleButtons } from '@viamrobotics/prime-core'

	import TrajectoryScrubber from '$lib/components/motion/TrajectoryScrubber.svelte'

	import type { PreviewDetail, PreviewMove } from './usePreviewMove.svelte'

	interface Props {
		preview: PreviewMove
		/** The frame this previews, for labelling the controls when several panels are open. */
		frameName: string
		/** No goal staged, or a move already running, so there is nothing worth planning. */
		disabled?: boolean
	}

	const { preview, frameName, disabled = false }: Props = $props()

	const planning = $derived(preview.status === 'planning')
	const ready = $derived(preview.status === 'ready')

	const detailLabels: Record<PreviewDetail, string> = {
		waypoints: 'Waypoints',
		interpolated: 'Interpolated',
	}
	const detailByLabel = new Map<string, PreviewDetail>(
		Object.entries(detailLabels).map(([value, label]) => [label, value as PreviewDetail])
	)

	const frameCount = $derived(preview.player.totalSteps)
</script>

<div class="flex flex-col gap-2">
	<Button
		variant="outline-success"
		disabled={disabled || planning}
		progress={planning ? 'indeterminate' : undefined}
		onclick={() => preview.requestPreview()}
	>
		{ready ? 'Re-plan preview' : 'Preview move'}
	</Button>

	{#if preview.status === 'error' && preview.message}
		<p
			class="text-danger-dark"
			role="alert"
		>
			{preview.message}
		</p>
	{:else if preview.status === 'already-at-goal' && preview.message}
		<!--
			`status` rather than `alert`, and not styled as a failure: the planner answered, and its
			answer was "nothing to do". A correct result in danger red teaches people to distrust
			the ones that are real.
		-->
		<p
			class="text-subtle-1"
			role="status"
		>
			{preview.message}
		</p>
	{/if}

	{#if ready}
		<Banner
			variant={BannerVariant.Info}
			size="sm"
		>
			{#snippet titleContent()}
				This preview is an approximation
			{/snippet}
			{#snippet subtitle()}
				Plans carry no timing, so this plays at a fixed rate. The arm may also deviate from the
				planned waypoints: how it moves between them is the component's decision, not the planner's.
			{/snippet}
		</Banner>

		<div class="flex flex-col gap-1">
			<ToggleButtons
				options={Object.values(detailLabels)}
				selected={detailLabels[preview.detail]}
				on:input={(event) => {
					const next = detailByLabel.get(event.detail)
					if (next) preview.detail = next
				}}
			>
				{#snippet legend()}
					Each frame is
				{/snippet}
			</ToggleButtons>

			<p
				class="text-subtle-2"
				role="status"
			>
				{#if preview.detail === 'waypoints'}
					{frameCount} frames, one per configuration the planner returned and nothing between.
				{:else}
					{frameCount} frames across {preview.plannedSteps} planned waypoints, along the straight joint
					path the planner checks between them.
				{/if}
			</p>
		</div>

		<TrajectoryScrubber
			player={preview.player}
			label="{frameName} preview"
			markers={preview.waypointIndices}
		/>
	{/if}
</div>
