<script lang="ts">
	import type { HTMLAttributes } from 'svelte/elements'

	import { type Entity } from 'koota'

	import type { DetailsTab } from '#lib/components/overlay/details/DetailsTabs.svelte'

	import { traits, useMappedEntitiesTraits } from '#lib/ecs/index.js'
	import { sectionsForTab, useDetailsSections } from '#lib/hooks/useDetailsSections.svelte.js'

	import AppearanceDetails from './AppearanceDetails.svelte'
	import CountDetails from './CountDetails.svelte'
	import DetailsPanel from './DetailsPanel.svelte'
	import DetailsSections from './DetailsSections.svelte'
	import DetailsTabs from './DetailsTabs.svelte'
	import DimensionsDetails from './DimensionsDetails.svelte'
	import FramePovTab from './FramePovTab.svelte'
	import GeometryOffsetDetails from './GeometryOffsetDetails.svelte'
	import PoseDetails from './PoseDetails.svelte'
	import RelationshipDetails from './RelationshipDetails.svelte'
	import SectionNotice from './SectionNotice.svelte'

	interface Props extends HTMLAttributes<HTMLDivElement> {
		/** The selection. Never empty. */
		entities: readonly Entity[]
		/** Shown above the tabs, for why the mode offers nothing more for this selection. */
		notice?: string
	}

	const { entities, notice, ...rest }: Props = $props()

	const sections = useDetailsSections()

	const reads = useMappedEntitiesTraits(
		() => entities,
		[traits.WorldMatrix, traits.CustomDetails],
		(entity) => ({
			entity,
			hasPose: entity.has(traits.WorldMatrix),
			hasCustomDetails: entity.has(traits.CustomDetails),
		})
	)

	const only = $derived(entities.length === 1 ? reads.current[0] : undefined)
	const isAllCustom = $derived(reads.current.every((read) => read.hasCustomDetails))
	const isAnyCustom = $derived(reads.current.some((read) => read.hasCustomDetails))
	const hasPose = $derived(reads.current.some((read) => read.hasPose))
	// Whatever registers a `test` section owns the tab's content. The panel only decides whether it shows.
	const hasTestable = $derived(
		sectionsForTab(sections?.current ?? [], 'test').some((section) =>
			entities.some((entity) => section.when?.(entity) ?? true)
		)
	)

	// An entity whose appearance a section edits gets that section in place of the built-in controls.
	const appearanceOwners = $derived(
		sectionsForTab(sections?.current ?? [], 'appearance').filter(
			(section) => section.replacesAppearance
		)
	)
	const ownedAppearanceCount = $derived(
		entities.filter((entity) => appearanceOwners.some((section) => section.when?.(entity) ?? true))
			.length
	)

	const tabs = $derived<DetailsTab[]>(
		isAllCustom
			? [{ id: 'details', label: 'Details', content: detailsTab }]
			: [
					{ id: 'details', label: 'Details', content: detailsTab },
					{ id: 'appearance', label: 'Appearance', content: appearanceTab },
					...(hasPose
						? [{ id: 'pov', label: 'POV', content: povTab, transparent: only !== undefined }]
						: []),
					...(hasTestable ? [{ id: 'test', label: 'Test', content: testTab }] : []),
				]
	)
</script>

{#snippet detailsTab()}
	<div class="flex flex-col gap-2.5 pt-3">
		{#if !isAnyCustom}
			<PoseDetails {entities} />
		{:else if !isAllCustom}
			<SectionNotice
				label="pose"
				message="Not every selected object shows a pose."
			/>
		{/if}

		<DimensionsDetails {entities} />

		<GeometryOffsetDetails {entities} />

		<CountDetails {entities} />
	</div>

	<RelationshipDetails {entities} />

	<DetailsSections
		{entities}
		tab="details"
	/>
{/snippet}

{#snippet appearanceTab()}
	<!-- A selection the owning sections only partly cover gets their notice from DetailsSections. -->
	{#if ownedAppearanceCount === 0}
		<AppearanceDetails {entities} />
	{/if}

	<DetailsSections
		{entities}
		tab="appearance"
	/>
{/snippet}

{#snippet povTab()}
	{#if only?.hasPose}
		<FramePovTab entity={only.entity} />
	{:else}
		<div class="pt-3">
			<SectionNotice
				label="point of view"
				message="Select a single object to look through it."
			/>
		</div>
	{/if}
{/snippet}

{#snippet testTab()}
	<DetailsSections
		{entities}
		tab="test"
	/>
{/snippet}

<DetailsPanel
	{entities}
	{...rest}
>
	{#if notice}
		<div class="bg-extralight px-2">
			<p
				class="mt-2 rounded border-l-4 border-yellow-600 bg-yellow-50 px-2 py-1.5 text-yellow-900"
				role="status"
			>
				{notice}
			</p>
		</div>
	{/if}

	<DetailsTabs items={tabs} />
</DetailsPanel>
