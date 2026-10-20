<script lang="ts">
	import type { ResourceName } from '@viamrobotics/sdk'

	import { useResourceStatuses } from '@viamrobotics/svelte-sdk'

	import { subtypeToColor } from '$lib/color'
	import { usePartID } from '$lib/hooks/usePartID.svelte'

	import ResourceWidgetRow from './ResourceWidgetRow.svelte'
	import { resourceWidgetToggles } from './resourceWidgetToggles'

	const partID = usePartID()
	const statuses = useResourceStatuses(() => partID.current)

	const formatSubtype = (subtype: string) =>
		subtype
			.split('_')
			.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
			.join(' ')

	const groups = $derived.by(() => {
		const bySubtype = new Map<string, ResourceName[]>()
		for (const { name: resource } of statuses.current) {
			if (!resource) continue
			if (resourceWidgetToggles(resource).length === 0) continue
			const list = bySubtype.get(resource.subtype) ?? []
			list.push(resource)
			bySubtype.set(resource.subtype, list)
		}

		return [...bySubtype.entries()]
			.map(([subtype, items]) => ({
				subtype,
				resources: items.toSorted((a, b) => a.name.localeCompare(b.name)),
			}))
			.toSorted((a, b) => a.subtype.localeCompare(b.subtype))
	})
</script>

<div class="text-gray-9 flex flex-col gap-1 text-xs">
	{#each groups as group (group.subtype)}
		{@const dotColor = subtypeToColor(group.subtype)?.getStyle()}
		<h3 class="border-gray-3 flex items-center gap-1.5 border-b py-1 text-sm">
			{#if dotColor}
				<span
					class="size-2 shrink-0 rounded-full"
					style="background-color: {dotColor}"
					aria-hidden="true"
				></span>
			{/if}
			<strong>{formatSubtype(group.subtype)}</strong>
		</h3>

		{#each group.resources as resource (resource.name)}
			<ResourceWidgetRow {resource} />
		{/each}
	{:else}
		<p class="text-subtle-2 py-2">No widgets available for this machine.</p>
	{/each}
</div>
