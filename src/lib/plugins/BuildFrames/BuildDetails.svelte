<script lang="ts">
	import type { HTMLAttributes } from 'svelte/elements'

	import { Button } from '@viamrobotics/prime-core'
	import { type Entity } from 'koota'

	import AddRelationship from '$lib/components/overlay/AddRelationship.svelte'
	import AxesHelperDetails from '$lib/components/overlay/details/AxesHelperDetails.svelte'
	import ColorDetails from '$lib/components/overlay/details/ColorDetails.svelte'
	import CountDetails from '$lib/components/overlay/details/CountDetails.svelte'
	import DetailsPanel from '$lib/components/overlay/details/DetailsPanel.svelte'
	import DimensionsDetails from '$lib/components/overlay/details/DimensionsDetails.svelte'
	import EditGeometryDetails from '$lib/components/overlay/details/EditGeometryDetails.svelte'
	import OpacityDetails from '$lib/components/overlay/details/OpacityDetails.svelte'
	import PoseDetails from '$lib/components/overlay/details/PoseDetails.svelte'
	import RelationshipDetails from '$lib/components/overlay/details/RelationshipDetails.svelte'
	import { traits, useTag, useTrait } from '$lib/ecs'
	import { FrameEditor } from '$lib/editing/FrameEditor'
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
	const partConfig = usePartConfig()

	const frameEditor = new FrameEditor(partConfig.updateFrame, partConfig.deleteFrame)

	const name = useTrait(() => entity, traits.Name)
	const points = useTrait(() => entity, traits.Points)
	const arrows = useTrait(() => entity, traits.Arrows)
	const framesAPI = useTrait(() => entity, traits.FramesAPI)
	const editable = useTrait(() => entity, traits.Editable)
	const customDetails = useTag(() => entity, traits.CustomDetails)

	const isFragmentComponentWithVariables = $derived(
		name.current && Object.keys(fragmentInfo.current?.[name.current]?.variables ?? {}).length > 0
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
</script>

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
				editable={showEditFrameOptions}
			/>
		{/if}

		{#if showEditFrameOptions}
			<EditGeometryDetails {entity} />
		{:else if !customDetails.current}
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
</DetailsPanel>
