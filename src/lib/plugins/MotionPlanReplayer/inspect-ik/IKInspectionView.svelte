<script lang="ts">
	import { Icon } from '@viamrobotics/prime-core'

	import IKCandidateList from './IKCandidateList.svelte'
	import { useIKInspection } from './useIKInspection.svelte'

	const ctx = useIKInspection()
</script>

<div class="flex h-full flex-col text-xs">
	<!--
		The back control lives in the body rather than the panel header: the header is a zag drag
		trigger, and a button inside it competes with the drag gesture.
	-->
	<button
		type="button"
		class="border-light text-subtle-1 hover:bg-ghost-light hover:text-default focus-visible:ring-info-dark flex shrink-0 items-center gap-1 border-b px-2 py-1.5 text-left focus-visible:ring-1 focus-visible:outline-none"
		onclick={() => ctx.exit()}
	>
		<Icon
			name="chevron-left"
			size="sm"
			aria-hidden="true"
		/>
		Back to plans
	</button>

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
