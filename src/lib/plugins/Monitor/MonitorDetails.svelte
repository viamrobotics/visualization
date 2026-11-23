<script lang="ts">
	import type { HTMLAttributes } from 'svelte/elements'

	import { type Entity } from 'koota'

	import type { DetailsTab } from '#lib/components/overlay/details/DetailsTabs.svelte'

	import { appearanceKeyOf } from '#lib/appearanceTarget.js'
	import AppearanceDetails from '#lib/components/overlay/details/AppearanceDetails.svelte'
	import CountDetails from '#lib/components/overlay/details/CountDetails.svelte'
	import DetailsPanel from '#lib/components/overlay/details/DetailsPanel.svelte'
	import DetailsSections from '#lib/components/overlay/details/DetailsSections.svelte'
	import DetailsTabs from '#lib/components/overlay/details/DetailsTabs.svelte'
	import DimensionsDetails from '#lib/components/overlay/details/DimensionsDetails.svelte'
	import GeometryOffsetDetails from '#lib/components/overlay/details/GeometryOffsetDetails.svelte'
	import PoseDetails from '#lib/components/overlay/details/PoseDetails.svelte'
	import RelationshipDetails from '#lib/components/overlay/details/RelationshipDetails.svelte'
	import SectionNotice from '#lib/components/overlay/details/SectionNotice.svelte'
	import { traits, useMappedEntitiesTraits } from '#lib/ecs/index.js'
	import { useResourceByName } from '#lib/hooks/useResourceByName.svelte.js'
	import ResourceTestTab from '#lib/plugins/ControlWidgets/ResourceTestTab.svelte'
	import { resourceWidgetToggles } from '#lib/plugins/ControlWidgets/resourceWidgetToggles.js'
	import FramePovTab from '#lib/plugins/FramePov/FramePovTab.svelte'

	import SessionAppearanceDetails, {
		type SessionAppearanceTarget,
	} from './SessionAppearanceDetails.svelte'

	interface Props extends HTMLAttributes<HTMLDivElement> {
		/** The selection. Never empty. */
		entities: readonly Entity[]
		/** Shown above the tabs, for why the mode offers nothing more for this selection. */
		notice?: string
	}

	const { entities, notice, ...rest }: Props = $props()

	const resourceByName = useResourceByName()

	const reads = useMappedEntitiesTraits(
		() => entities,
		[traits.Name, traits.FramesAPI, traits.CustomDetails],
		(entity) => {
			const name = entity.get(traits.Name)
			const resource = name ? resourceByName.current[name] : undefined
			return {
				entity,
				name,
				isFrame: entity.has(traits.FramesAPI),
				hasCustomDetails: entity.has(traits.CustomDetails),
				testableResource:
					resource && resourceWidgetToggles(resource).length > 0 ? resource : undefined,
			}
		}
	)

	const only = $derived(entities.length === 1 ? reads.current[0] : undefined)
	const isAllCustom = $derived(reads.current.every((read) => read.hasCustomDetails))
	const isAnyCustom = $derived(reads.current.some((read) => read.hasCustomDetails))
	const hasFrame = $derived(reads.current.some((read) => read.isFrame && read.name !== undefined))
	const hasTestable = $derived(reads.current.some((read) => read.testableResource))

	// A frame's edits follow the same rules as a saved appearance, so they reach the frames inside it.
	const sessionTargets = $derived(
		reads.current.flatMap(({ entity, name, isFrame }): SessionAppearanceTarget[] =>
			isFrame && name !== undefined ? [{ entity, ...appearanceKeyOf(name) }] : []
		)
	)

	const tabs = $derived<DetailsTab[]>(
		isAllCustom
			? [{ id: 'details', label: 'Details', content: detailsTab }]
			: [
					{ id: 'details', label: 'Details', content: detailsTab },
					{ id: 'appearance', label: 'Appearance', content: appearanceTab },
					...(hasFrame
						? [{ id: 'pov', label: 'POV', content: povTab, transparent: only !== undefined }]
						: []),
					...(hasTestable ? [{ id: 'test', label: 'Test', content: testTab }] : []),
				]
	)
</script>

{#snippet detailsTab()}
	<div class="flex flex-col gap-2.5 pt-3">
		{#if !isAnyCustom}
			<PoseDetails
				{entities}
				editable={false}
			/>
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
	{#if sessionTargets.length === entities.length}
		<SessionAppearanceDetails targets={sessionTargets} />
	{:else if sessionTargets.length === 0}
		<AppearanceDetails {entities} />
	{:else}
		<div class="pt-3">
			<SectionNotice
				label="appearance"
				message="Frames and other objects keep their appearance differently. Select only one kind to edit it."
			/>
		</div>
	{/if}

	<DetailsSections
		{entities}
		tab="appearance"
	/>
{/snippet}

{#snippet povTab()}
	{#if only?.name !== undefined}
		<FramePovTab
			entity={only.entity}
			frameName={only.name}
		/>
	{:else}
		<div class="pt-3">
			<SectionNotice
				label="point of view"
				message="Select a single frame to look through it."
			/>
		</div>
	{/if}
{/snippet}

{#snippet testTab()}
	{#if only?.testableResource}
		<ResourceTestTab resource={only.testableResource} />
	{:else}
		<div class="pt-3">
			<SectionNotice
				label="test"
				message="Select a single resource to test it."
			/>
		</div>
	{/if}
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
