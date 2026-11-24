<script lang="ts">
	import { mdiChevronDown, mdiChevronRight } from '@mdi/js'
	import { Icon } from '@viamrobotics/prime-ui'

	import type { IKSeedBucket } from './ik-candidates'

	import IKCandidateRow from './IKCandidateRow.svelte'
	import IKStatusDot from './IKStatusDot.svelte'
	import { IK_STATUS_LABEL, type IKStatus } from './parse-ik-solutions'

	interface Props {
		bucket: IKSeedBucket
		expanded: boolean
		selectedId: string | null
		ontoggle: () => void
		onselect: (id: string) => void
	}

	const { bucket, expanded, selectedId, ontoggle, onselect }: Props = $props()

	const ORDER: IKStatus[] = ['valid', 'path-invalid', 'invalid']
</script>

<div class="flex flex-col">
	<button
		type="button"
		aria-expanded={expanded}
		class="hover:bg-ghost-light focus-visible:ring-info-dark flex w-full items-center gap-1 rounded px-1 py-1 text-left focus-visible:ring-1 focus-visible:outline-none"
		onclick={ontoggle}
	>
		<Icon
			icon={expanded ? mdiChevronDown : mdiChevronRight}
			size="sm"
		/>
		<span class="grow truncate">{bucket.seed}</span>
		{#each ORDER as status (status)}
			<span
				class="text-subtle-1 flex items-center gap-1 tabular-nums"
				title={`${bucket.counts[status]} ${IK_STATUS_LABEL[status]}`}
			>
				<IKStatusDot {status} />
				{bucket.counts[status]}
			</span>
		{/each}
	</button>

	{#if expanded}
		<div class="flex flex-col gap-0.5 pb-1 pl-4">
			{#each bucket.candidates as candidate (candidate.id)}
				<IKCandidateRow
					{candidate}
					selected={candidate.id === selectedId}
					onselect={() => onselect(candidate.id)}
				/>
			{/each}
		</div>
	{/if}
</div>
