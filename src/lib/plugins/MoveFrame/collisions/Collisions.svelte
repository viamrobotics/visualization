<!--
@component

The collision readout inside a move panel.

Reads the shared `collisionReports` store, which one `CollisionDetector` writes for every
open panel. Staged pairs lead, because where the move would put things is the warning
worth acting on before pressing Execute.
-->
<script lang="ts">
	import { mdiAlertCircle } from '@mdi/js'
	import { Icon } from '@viamrobotics/prime-ui'

	import { type CollisionReport, collisionReports } from './collisionStore.svelte'

	const reports = $derived(collisionReports.current)
	const staged = $derived(reports.filter((report) => report.staged))
	const live = $derived(reports.filter((report) => !report.staged))
</script>

{#snippet pairList(items: CollisionReport[])}
	<ul class="font-roboto-mono flex flex-col gap-0.5">
		{#each items as report (`${report.a}\0${report.b}`)}
			<li class="flex flex-wrap items-center gap-1.5">
				<span class="text-default">{report.a}</span>
				<span
					class="text-subtle-2"
					aria-hidden="true">↔</span
				>
				<span class="text-default">{report.b}</span>
			</li>
		{/each}
	</ul>
{/snippet}

<section
	class="flex flex-col gap-2"
	aria-label="Collisions"
>
	<strong class="font-semibold">collisions</strong>

	{#if staged.length > 0}
		<div class="border-danger-medium bg-danger-light flex flex-col gap-1 border px-2 py-1.5">
			<div class="text-danger-dark flex items-center gap-1.5">
				<Icon icon={mdiAlertCircle} />
				<span class="font-semibold">
					Move would collide ({staged.length})
				</span>
			</div>
			{@render pairList(staged)}
		</div>
	{/if}

	{#if live.length > 0}
		<div class="flex flex-col gap-1">
			<span class="text-subtle-2">Currently touching ({live.length})</span>
			{@render pairList(live)}
		</div>
	{/if}

	{#if staged.length === 0 && live.length === 0}
		<p class="text-subtle-2">
			Nothing intersecting. An arm is never checked against its own links.
		</p>
	{/if}
</section>
