<script lang="ts">
	import { Icon, Tooltip } from '@viamrobotics/prime-core'

	import IKCandidateDetail from './IKCandidateDetail.svelte'
	import IKCandidateRow from './IKCandidateRow.svelte'
	import IKSeedGroup from './IKSeedGroup.svelte'
	import IKStatusDot from './IKStatusDot.svelte'
	import { IK_STATUS_DESCRIPTION, IK_STATUS_LABEL, type IKStatus } from './parse-ik-solutions'
	import { useIKInspection } from './useIKInspection.svelte'

	const ctx = useIKInspection()

	const ORDER: IKStatus[] = ['valid', 'path-invalid', 'invalid']
</script>

<div class="flex h-full flex-col">
	<div class="border-light flex shrink-0 flex-col gap-2 border-b p-2">
		<div class="flex items-center gap-2">
			<span class="font-medium tabular-nums">{ctx.totalCount} candidates</span>
			<span class="text-subtle-1 ml-auto tabular-nums">{ctx.seedBuckets.length} seeds</span>
		</div>

		<div class="flex flex-wrap items-center gap-1">
			{#each ORDER as status (status)}
				{@const active = ctx.statusFilter.has(status)}
				<button
					type="button"
					aria-pressed={active}
					class={[
						'flex items-center gap-1 rounded border px-1.5 py-0.5 tabular-nums',
						'hover:bg-ghost-light focus-visible:ring-info-dark focus-visible:ring-1 focus-visible:outline-none',
						active ? 'border-medium bg-light' : 'border-light text-subtle-2',
					]}
					onclick={() => ctx.toggleStatusFilter(status)}
				>
					<IKStatusDot {status} />
					{ctx.counts[status]}
					<span class="sr-only">{IK_STATUS_LABEL[status]}</span>
				</button>
			{/each}

			<Tooltip
				let:tooltipID
				location="bottom"
			>
				<button
					type="button"
					aria-describedby={tooltipID}
					aria-label="What the colours mean"
					class="text-subtle-1 hover:text-default hover:bg-ghost-light focus-visible:ring-info-dark rounded p-0.5 focus-visible:ring-1 focus-visible:outline-none"
				>
					<Icon
						name="help-circle-outline"
						size="sm"
						aria-hidden="true"
					/>
				</button>
				<span slot="description">
					{#each ORDER as status (status)}
						<span class="mb-0.5 block last:mb-0">
							<span class="font-medium">{IK_STATUS_LABEL[status]}</span> — {IK_STATUS_DESCRIPTION[
								status
							]}
						</span>
					{/each}
				</span>
			</Tooltip>

			<div class="ml-auto flex items-center gap-1">
				<span class="text-subtle-1">Sort</span>
				{#each [['seed', 'Seed'], ['cost', 'Cost']] as const as [mode, label] (mode)}
					<button
						type="button"
						aria-pressed={ctx.sortMode === mode}
						class={[
							'rounded border px-1.5 py-0.5',
							'hover:bg-ghost-light focus-visible:ring-info-dark focus-visible:ring-1 focus-visible:outline-none',
							ctx.sortMode === mode ? 'border-medium bg-light' : 'border-light text-subtle-2',
						]}
						onclick={() => ctx.setSortMode(mode)}
					>
						{label}
					</button>
				{/each}
			</div>
		</div>
	</div>

	<div class="min-h-0 flex-1 overflow-y-auto p-1">
		{#if ctx.visibleCandidates.length === 0}
			<div class="text-subtle-1 flex h-full flex-col items-center justify-center gap-2 text-center">
				<p>No candidates match this filter.</p>
				<button
					type="button"
					class="border-light hover:bg-light focus-visible:ring-info-dark rounded border px-2 py-1 focus-visible:ring-1 focus-visible:outline-none"
					onclick={() => ctx.resetStatusFilter()}
				>
					Show all
				</button>
			</div>
		{:else if ctx.sortMode === 'seed'}
			{#each ctx.seedBuckets as bucket (bucket.seedIndex)}
				<IKSeedGroup
					{bucket}
					expanded={ctx.expandedSeeds.has(bucket.seedIndex)}
					selectedId={ctx.selectedCandidate?.id ?? null}
					ontoggle={() => ctx.toggleSeed(bucket.seedIndex)}
					onselect={(id) => ctx.select(id)}
				/>
			{/each}
		{:else}
			<div class="flex flex-col gap-0.5">
				{#each ctx.visibleCandidates as candidate (candidate.id)}
					<IKCandidateRow
						{candidate}
						selected={candidate.id === ctx.selectedCandidate?.id}
						showSeed
						onselect={() => ctx.select(candidate.id)}
					/>
				{/each}
			</div>
		{/if}
	</div>

	{#if ctx.selectedCandidate}
		<IKCandidateDetail
			candidate={ctx.selectedCandidate}
			poseSets={ctx.poseSets}
			poseVisibility={ctx.poseVisibility}
			setPoseVisible={ctx.setPoseVisible}
		/>
	{/if}
</div>
