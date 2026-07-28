<script lang="ts">
	import { useThrelte } from '@threlte/core'
	import { Badge, Icon } from '@viamrobotics/prime-core'

	import FloatingPanel from '$lib/components/overlay/FloatingPanel.svelte'

	import IKCandidateList from './IKCandidateList.svelte'
	import { useIKInspection } from './useIKInspection.svelte'

	const ctx = useIKInspection()
	const { dom } = useThrelte()

	const SIZE = { width: 380, height: 520 }

	// Every FloatingPanel renders at the same z-index with no bring-to-front, so opening away from
	// the replayer's centred default is the only thing keeping the two from stacking.
	const defaultPosition = {
		x: Math.max(16, dom.clientWidth - SIZE.width - 16),
		y: 96,
	}
</script>

<FloatingPanel
	bind:isOpen={() => ctx.isOpen, (open) => ctx.setOpen(open)}
	title="IK Inspection"
	defaultSize={SIZE}
	minSize={{ width: 320, height: 320 }}
	{defaultPosition}
	resizable
	bodyClass="bg-white"
>
	{#snippet headerPrefix()}
		<Badge
			label="demo data"
			variant="warning"
		/>
	{/snippet}

	<div class="flex h-full flex-col text-xs">
		{#if ctx.status === 'loading'}
			<div
				class="text-subtle-1 flex grow flex-col items-center justify-center gap-3"
				role="status"
			>
				<div class="flex w-40 flex-col gap-1.5">
					{#each [0, 1, 2] as row (row)}
						<div class="bg-light h-2 animate-pulse rounded"></div>
					{/each}
				</div>
				<p>Running IK inspection…</p>
			</div>
		{:else if ctx.status === 'error'}
			<div class="flex grow flex-col items-center justify-center gap-2 p-4 text-center">
				<Icon
					name="alert-circle-outline"
					size="lg"
					aria-hidden="true"
				/>
				<p class="text-danger-dark break-words">{ctx.error}</p>
			</div>
		{:else if ctx.status === 'ready'}
			<p class="text-subtle-2 border-light shrink-0 border-b px-2 py-1">
				Demo fixture — candidates come from <span class="font-roboto-mono">pirouette-request</span>,
				not from {ctx.planName ?? 'the selected plan'}.
			</p>
			<div class="min-h-0 flex-1">
				<IKCandidateList />
			</div>
		{:else}
			<div class="text-subtle-1 flex grow items-center justify-center p-4 text-center">
				Use a plan's bug icon to inspect its IK candidates.
			</div>
		{/if}
	</div>
</FloatingPanel>
