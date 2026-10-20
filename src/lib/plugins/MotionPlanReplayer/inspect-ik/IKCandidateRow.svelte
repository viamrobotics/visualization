<script lang="ts">
	import { Tooltip } from '@viamrobotics/prime-core'

	import type { IKCandidate } from './ik-candidates'

	import IKStatusDot from './IKStatusDot.svelte'
	import { isScored } from './parse-ik-solutions'

	interface Props {
		candidate: IKCandidate
		selected: boolean
		/** Cost-sorted mode has no seed headers, so the row has to carry its own. */
		showSeed?: boolean
		onselect: () => void
	}

	const { candidate, selected, showSeed = false, onselect }: Props = $props()

	const cost = $derived(candidate.solution.cost)
</script>

<Tooltip
	let:tooltipID
	location="right"
>
	<button
		type="button"
		aria-describedby={tooltipID}
		aria-pressed={selected}
		class={[
			'flex w-full items-center gap-2 rounded px-2 py-1 text-left',
			'hover:bg-ghost-light focus-visible:ring-info-dark focus-visible:ring-1 focus-visible:outline-none',
			selected && 'bg-light font-medium',
		]}
		onclick={onselect}
	>
		<IKStatusDot
			status={candidate.status}
			labelled
		/>
		<span class="font-roboto-mono grow tabular-nums">
			{#if isScored(cost)}
				{cost.toFixed(4)}
			{:else}
				<span class="text-subtle-2">—</span>
			{/if}
		</span>
		{#if showSeed}
			<span class="text-subtle-2 min-w-0 truncate">{candidate.seed}</span>
		{/if}
	</button>
	<p slot="description">
		{candidate.seed} · #{candidate.indexInSeed + 1}{isScored(cost) ? '' : ' · unscored'}
	</p>
</Tooltip>
