<script lang="ts">
	import type { HTMLAttributes } from 'svelte/elements'

	import { type Entity } from 'koota'

	import AxesHelperDetails from '$lib/components/overlay/details/AxesHelperDetails.svelte'
	import ColorDetails from '$lib/components/overlay/details/ColorDetails.svelte'
	import CountDetails from '$lib/components/overlay/details/CountDetails.svelte'
	import DetailsPanel from '$lib/components/overlay/details/DetailsPanel.svelte'
	import DimensionsDetails from '$lib/components/overlay/details/DimensionsDetails.svelte'
	import OpacityDetails from '$lib/components/overlay/details/OpacityDetails.svelte'
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
</script>

<DetailsPanel
	{entity}
	{...rest}
>
	<h3
		class="text-subtle-2 pt-3 pb-2"
		data-testid="details-header"
	>
		Details
	</h3>

	<div class="flex flex-col gap-2.5">
		{#if !customDetails.current}
			<PoseDetails
				{entity}
				editable={false}
			/>
		{/if}

		{#if !customDetails.current}
			<DimensionsDetails {entity} />
		{/if}

		<CountDetails {entity} />

		{#if !customDetails.current}
			<ColorDetails {entity} />
			<OpacityDetails {entity} />
			<AxesHelperDetails {entity} />
		{/if}
	</div>

	<RelationshipDetails {entity} />

	{#each sections?.current ?? [] as section (section)}
		{#if section.when?.(entity) ?? true}
			{@render section.snippet({ entity })}
		{/if}
	{/each}
</DetailsPanel>
