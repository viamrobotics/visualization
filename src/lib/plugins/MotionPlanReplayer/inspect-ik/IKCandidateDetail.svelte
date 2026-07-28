<script lang="ts">
	import type { IKCandidate } from './ik-candidates'
	import type { PoseKind, PoseSet } from './pose-sets'

	import IKStatusDot from './IKStatusDot.svelte'
	import { hasSolution, IK_STATUS_LABEL, isScored } from './parse-ik-solutions'

	interface Props {
		candidate: IKCandidate
		poseSets: PoseSet[]
		poseVisibility: Record<PoseKind, boolean>
		setPoseVisible: (kind: PoseKind, visible: boolean) => void
	}

	const { candidate, poseSets, poseVisibility, setPoseVisible }: Props = $props()

	let expanded = $state(false)

	const cost = $derived(candidate.solution.cost)
	const detail = $derived(candidate.solution.error ?? candidate.solution.firstError ?? '')
	// Roughly the two lines the clamp shows — below it the reveal control is just noise.
	const clampable = $derived(detail.length > 120)
	const hasStartPose = $derived(poseSets.some((poseSet) => poseSet.kind === 'start'))
	const solved = $derived(hasSolution(candidate.solution))
</script>

<div class="border-light flex shrink-0 flex-col gap-2 border-t p-2">
	<div class="flex items-center gap-2">
		<IKStatusDot
			status={candidate.status}
			labelled
		/>
		<span class="min-w-0 truncate">{candidate.seed} · #{candidate.indexInSeed + 1}</span>
		<span class="text-subtle-1 ml-auto shrink-0">{IK_STATUS_LABEL[candidate.status]}</span>
		<span class="font-roboto-mono shrink-0 tabular-nums">
			{#if isScored(cost)}
				{cost.toFixed(4)}
			{:else}
				<span class="text-subtle-2">unscored</span>
			{/if}
		</span>
	</div>

	<div class="flex flex-wrap items-center gap-1">
		<span class="text-subtle-1 mr-0.5">Show</span>
		{#each poseSets as poseSet (poseSet.kind)}
			{@const shown = poseVisibility[poseSet.kind]}
			<button
				type="button"
				aria-pressed={shown}
				class={[
					'flex items-center gap-1 rounded border px-1.5 py-0.5',
					'hover:bg-ghost-light focus-visible:ring-info-dark focus-visible:ring-1 focus-visible:outline-none',
					shown ? 'border-medium bg-light' : 'border-light text-subtle-2',
				]}
				onclick={() => setPoseVisible(poseSet.kind, !shown)}
			>
				<span
					class={[
						'size-2 shrink-0 rounded-full',
						poseSet.style.swatchClass,
						// Hollow rather than hidden, so the row keeps its shape and the colour stays legible.
						!shown && 'opacity-40',
					]}
					aria-hidden="true"
				></span>
				{poseSet.label}
			</button>
		{/each}
	</div>

	{#if !hasStartPose}
		<p class="text-subtle-2">
			Start pose unavailable — the request carries no start configuration.
		</p>
	{/if}

	{#if detail}
		<div class="border-light bg-extralight rounded border p-1.5">
			<p class={['font-roboto-mono text-[11px] break-words', !expanded && 'line-clamp-2']}>
				{detail}
			</p>
			{#if clampable}
				<button
					type="button"
					class="text-link hover:text-link focus-visible:ring-info-dark mt-1 rounded focus-visible:ring-1 focus-visible:outline-none"
					aria-expanded={expanded}
					onclick={() => (expanded = !expanded)}
				>
					{expanded ? 'Show less' : 'Show more'}
				</button>
			{/if}
		</div>
	{:else if !solved}
		<p class="text-subtle-1">
			The solver returned no configuration for this seed, so there is no pose to draw — it failed
			before producing a candidate rather than producing one that collides.
		</p>
	{:else}
		<p class="text-subtle-2">No failure detail was recorded for this candidate.</p>
	{/if}
</div>
