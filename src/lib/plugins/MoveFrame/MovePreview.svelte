<script lang="ts">
	import { mdiInformationOutline } from '@mdi/js'
	import { ToggleButtons } from '@viamrobotics/prime-controls'
	import { Banner, Icon, Tooltip } from '@viamrobotics/prime-ui'

	import TrajectoryScrubber from '#lib/components/motion/TrajectoryScrubber.svelte'

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
	const previewDisabled = $derived(disabled || planning)

	const detailItems: { value: PreviewDetail; label: string }[] = [
		{ value: 'waypoints', label: 'Waypoints' },
		{ value: 'interpolated', label: 'Interpolated' },
	]

	const frameCount = $derived(preview.player.totalSteps)
</script>

<div class="flex flex-col gap-2">
	<button
		type="button"
		class="button button-compact button-success button-outline"
		aria-disabled={previewDisabled || undefined}
		aria-busy={planning || undefined}
		onclick={() => {
			if (!previewDisabled) preview.requestPreview()
		}}
	>
		{#if planning}
			<span
				class="progress-dots"
				aria-hidden="true"
			></span>
		{/if}
		{ready ? 'Re-plan preview' : 'Preview move'}
	</button>

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
		<!-- A standing caveat, not an update, so it must not announce as a live `status` region. -->
		<Banner
			variant="info"
			role="note"
		>
			<Banner.Description>
				<span class="inline-flex items-center gap-1">
					This preview is an approximation
					<Tooltip>
						<Tooltip.Trigger>
							<button
								type="button"
								class="flex opacity-70 hover:opacity-100"
								aria-label="About this approximation"
							>
								<Icon icon={mdiInformationOutline} />
							</button>
						</Tooltip.Trigger>
						<Tooltip.Content placement="top">
							Plans carry no timing, so this plays at a fixed rate. The arm may also deviate from
							the planned waypoints: how it moves between them is the component's decision, not the
							planner's.
						</Tooltip.Content>
					</Tooltip>
				</span>
			</Banner.Description>
		</Banner>

		<div class="flex flex-col gap-1">
			<ToggleButtons
				label="Each frame is"
				items={detailItems}
				bind:value={
					() => preview.detail,
					(next) => {
						if (next === 'waypoints' || next === 'interpolated') preview.detail = next
					}
				}
			/>

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
