<script lang="ts">
	import type { HTMLAttributes } from 'svelte/elements'

	import { Button } from '@viamrobotics/prime-core'
	import { type Entity } from 'koota'

	import type { DetailsTab } from '$lib/components/overlay/details/DetailsTabs.svelte'

	import AddRelationship from '$lib/components/overlay/AddRelationship.svelte'
	import AppearanceDetails from '$lib/components/overlay/details/AppearanceDetails.svelte'
	import CountDetails from '$lib/components/overlay/details/CountDetails.svelte'
	import DetailsPanel from '$lib/components/overlay/details/DetailsPanel.svelte'
	import DetailsTabs from '$lib/components/overlay/details/DetailsTabs.svelte'
	import DimensionsDetails from '$lib/components/overlay/details/DimensionsDetails.svelte'
	import EditGeometryDetails from '$lib/components/overlay/details/EditGeometryDetails.svelte'
	import PoseDetails from '$lib/components/overlay/details/PoseDetails.svelte'
	import RelationshipDetails from '$lib/components/overlay/details/RelationshipDetails.svelte'
	import { traits, useTag, useTrait } from '$lib/ecs'
	import { FrameEditor } from '$lib/editing/FrameEditor'
	import { isFrameVariableLocked } from '$lib/frameVariableLocks'
	import { useConfigFrames } from '$lib/hooks/useConfigFrames.svelte'
	import { useDetailsSections } from '$lib/hooks/useDetailsSections.svelte'
	import { useEnvironment } from '$lib/hooks/useEnvironment.svelte'
	import { useFragmentInfo } from '$lib/hooks/useFragmentInfo.svelte'
	import { usePartConfig } from '$lib/hooks/usePartConfig.svelte'

	interface Props extends HTMLAttributes<HTMLDivElement> {
		entity: Entity
	}

	const { entity, ...rest }: Props = $props()

	const environment = useEnvironment()
	const sections = useDetailsSections()
	const fragmentInfo = useFragmentInfo()
	const configFrames = useConfigFrames()
	const partConfig = usePartConfig()

	const frameEditor = new FrameEditor(partConfig.updateFrame, partConfig.deleteFrame)

	const name = useTrait(() => entity, traits.Name)
	const points = useTrait(() => entity, traits.Points)
	const arrows = useTrait(() => entity, traits.Arrows)
	const framesAPI = useTrait(() => entity, traits.FramesAPI)
	const editable = useTrait(() => entity, traits.Editable)
	const customDetails = useTag(() => entity, traits.CustomDetails)

	const isFragmentComponentWithVariables = $derived(
		name.current !== undefined &&
			isFrameVariableLocked(
				fragmentInfo.current?.[name.current],
				configFrames.effectiveFrames.get(name.current)
			)
	)
	const showEditFrameOptions = $derived(
		!!framesAPI.current &&
			!!editable.current &&
			partConfig.hasEditPermissions &&
			!isFragmentComponentWithVariables
	)
	const showConfigUnavailableWarning = $derived(
		!!framesAPI.current && !partConfig.hasEditPermissions && partConfig.error !== undefined
	)
	const showRelationshipOptions = $derived(!!points.current || !!arrows.current)

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
				editable={showEditFrameOptions}
			/>
		{/if}

		{#if showEditFrameOptions}
			<EditGeometryDetails {entity} />
		{:else}
			<DimensionsDetails {entity} />
		{/if}

		<CountDetails {entity} />
	</div>

	<RelationshipDetails {entity} />

	{#each sections?.current ?? [] as section (section)}
		{#if section.when?.(entity) ?? true}
			{@render section.snippet({ entity })}
		{/if}
	{/each}

	{#if showRelationshipOptions || (showEditFrameOptions && environment.current.isStandalone)}
		<h3 class="text-subtle-2 pt-3 pb-2">Actions</h3>
	{/if}

	{#if showRelationshipOptions}
		<AddRelationship {entity} />
	{/if}

	{#if showEditFrameOptions && environment.current.isStandalone}
		<Button
			variant="danger"
			class="mt-2 w-full"
			onclick={() => frameEditor.deleteFrame(entity)}
		>
			Delete frame
		</Button>
	{/if}
{/snippet}

{#snippet appearanceTab()}
	<AppearanceDetails {entity} />
{/snippet}

<DetailsPanel
	{entity}
	{...rest}
>
	{#if isFragmentComponentWithVariables}
		<p
			class="mt-2 rounded border-l-4 border-yellow-600 bg-yellow-50 px-2 py-1.5 text-yellow-900"
			data-testid="fragment-variables-warning"
			role="status"
		>
			This component is from a fragment with variables, editing frames in 3D scene is disabled
		</p>
	{/if}

	{#if showConfigUnavailableWarning}
		<div
			class="mt-2 rounded border-l-4 border-yellow-600 bg-yellow-50 px-2 py-1.5 text-yellow-900"
			data-testid="config-unavailable-warning"
			role="status"
		>
			<p>Frame editing is disabled — this machine's configuration could not be read.</p>
			<p class="mt-1 wrap-break-word text-yellow-800">{partConfig.error}</p>
		</div>
	{/if}

	<DetailsTabs items={tabs} />
</DetailsPanel>
