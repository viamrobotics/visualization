<script lang="ts">
	import type { HTMLAttributes } from 'svelte/elements'

	import { type Entity } from 'koota'

	import type { DetailsTab } from '$lib/components/overlay/details/DetailsTabs.svelte'

	import AppearanceDetails from '$lib/components/overlay/details/AppearanceDetails.svelte'
	import CountDetails from '$lib/components/overlay/details/CountDetails.svelte'
	import DetailsPanel from '$lib/components/overlay/details/DetailsPanel.svelte'
	import DetailsTabs from '$lib/components/overlay/details/DetailsTabs.svelte'
	import DimensionsDetails from '$lib/components/overlay/details/DimensionsDetails.svelte'
	import PoseDetails from '$lib/components/overlay/details/PoseDetails.svelte'
	import RelationshipDetails from '$lib/components/overlay/details/RelationshipDetails.svelte'
	import { traits, useTag } from '$lib/ecs'
	import { useDetailsSections } from '$lib/hooks/useDetailsSections.svelte'

	interface Props extends HTMLAttributes<HTMLDivElement> {
		entity: Entity
	}

	const { entity, ...rest }: Props = $props()

	const sections = useDetailsSections()
	const customDetails = useTag(() => entity, traits.CustomDetails)

	const tabs = $derived<DetailsTab[]>(
		customDetails.current
			? [{ id: 'details', label: 'Details', content: detailsTab }]
			: [
					{ id: 'details', label: 'Details', content: detailsTab },
					{ id: 'appearance', label: 'Appearance', content: appearanceTab },
				]
	)
</script>

{#snippet detailsTab()}
	<div class="flex flex-col gap-2.5 pt-3">
		{#if !customDetails.current}
			<PoseDetails
				{entity}
				editable={false}
			/>
		{/if}

		<DimensionsDetails {entity} />

		<CountDetails {entity} />
	</div>

	<RelationshipDetails {entity} />

	{#each sections?.current ?? [] as section (section)}
		{#if section.when?.(entity) ?? true}
			{@render section.snippet({ entity })}
		{/if}
	{/each}
{/snippet}

{#snippet appearanceTab()}
	<AppearanceDetails {entity} />
{/snippet}

<DetailsPanel
	{entity}
	{...rest}
>
	<DetailsTabs items={tabs} />
</DetailsPanel>
