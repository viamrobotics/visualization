<script lang="ts">
	import type { HTMLAttributes } from 'svelte/elements'

	import { type Entity } from 'koota'

	import type { DetailsTab } from '$lib/components/overlay/details/DetailsTabs.svelte'

	import { appearanceKeyOf } from '$lib/appearanceTarget'
	import AppearanceDetails from '$lib/components/overlay/details/AppearanceDetails.svelte'
	import CountDetails from '$lib/components/overlay/details/CountDetails.svelte'
	import DetailsPanel from '$lib/components/overlay/details/DetailsPanel.svelte'
	import DetailsSections from '$lib/components/overlay/details/DetailsSections.svelte'
	import DetailsTabs from '$lib/components/overlay/details/DetailsTabs.svelte'
	import DimensionsDetails from '$lib/components/overlay/details/DimensionsDetails.svelte'
	import GeometryOffsetDetails from '$lib/components/overlay/details/GeometryOffsetDetails.svelte'
	import PoseDetails from '$lib/components/overlay/details/PoseDetails.svelte'
	import RelationshipDetails from '$lib/components/overlay/details/RelationshipDetails.svelte'
	import { traits, useTag, useTrait } from '$lib/ecs'

	import SessionAppearanceDetails from './SessionAppearanceDetails.svelte'

	interface Props extends HTMLAttributes<HTMLDivElement> {
		entity: Entity
	}

	const { entity, ...rest }: Props = $props()

	const customDetails = useTag(() => entity, traits.CustomDetails)
	const name = useTrait(() => entity, traits.Name)
	const framesAPI = useTrait(() => entity, traits.FramesAPI)

	// A frame's edits follow the same rules as a saved appearance, so they reach the frames inside it.
	const appearanceKey = $derived(
		framesAPI.current && name.current !== undefined ? appearanceKeyOf(name.current) : undefined
	)

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

		<GeometryOffsetDetails {entity} />

		<CountDetails {entity} />
	</div>

	<RelationshipDetails {entity} />

	<DetailsSections
		{entity}
		tab="details"
	/>
{/snippet}

{#snippet appearanceTab()}
	{#if appearanceKey}
		<SessionAppearanceDetails
			{entity}
			componentName={appearanceKey.componentName}
			frameId={appearanceKey.frameId}
		/>
	{:else}
		<AppearanceDetails {entity} />
	{/if}

	<DetailsSections
		{entity}
		tab="appearance"
	/>
{/snippet}

<DetailsPanel
	{entity}
	{...rest}
>
	<DetailsTabs items={tabs} />
</DetailsPanel>
