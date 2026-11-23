<script lang="ts">
	import type { HTMLAttributes } from 'svelte/elements'

	import { Button } from '@viamrobotics/prime-core'
	import { type Entity } from 'koota'

	import type { DetailsTab } from '#lib/components/overlay/details/DetailsTabs.svelte'

	import { appearanceTargetOf } from '#lib/appearanceTarget.js'
	import { complexShapeOwner } from '#lib/complexShapeOwner.js'
	import AddRelationship from '#lib/components/overlay/AddRelationship.svelte'
	import AppearanceDetails from '#lib/components/overlay/details/AppearanceDetails.svelte'
	import CountDetails from '#lib/components/overlay/details/CountDetails.svelte'
	import DetailsPanel from '#lib/components/overlay/details/DetailsPanel.svelte'
	import DetailsSections from '#lib/components/overlay/details/DetailsSections.svelte'
	import DetailsTabs from '#lib/components/overlay/details/DetailsTabs.svelte'
	import DimensionsDetails from '#lib/components/overlay/details/DimensionsDetails.svelte'
	import EditGeometryDetails from '#lib/components/overlay/details/EditGeometryDetails.svelte'
	import GeometryOffsetDetails from '#lib/components/overlay/details/GeometryOffsetDetails.svelte'
	import PoseDetails from '#lib/components/overlay/details/PoseDetails.svelte'
	import RelationshipDetails from '#lib/components/overlay/details/RelationshipDetails.svelte'
	import SectionNotice from '#lib/components/overlay/details/SectionNotice.svelte'
	import { traits, useMappedEntitiesTraits } from '#lib/ecs/index.js'
	import { FrameEditor } from '#lib/editing/FrameEditor.js'
	import { isFrameVariableLocked } from '#lib/frameVariableLocks.js'
	import { useConfigFrames } from '#lib/hooks/useConfigFrames.svelte.js'
	import { useEnvironment } from '#lib/hooks/useEnvironment.svelte.js'
	import { useFragmentInfo } from '#lib/hooks/useFragmentInfo.svelte.js'
	import { usePartConfig } from '#lib/hooks/usePartConfig.svelte.js'
	import { isObstacleComponent } from '#lib/obstacleAttributes.js'
	import FramePovTab from '#lib/plugins/FramePov/FramePovTab.svelte'

	import ConfigAppearanceDetails, {
		type ConfigAppearanceTarget,
	} from './ConfigAppearanceDetails.svelte'
	import ObstacleSection from './ObstacleEditor/ObstacleSection.svelte'
	import ObstacleShapeDetails from './ObstacleEditor/ObstacleShapeDetails.svelte'
	import RemoveObstacleShapeButton from './ObstacleEditor/RemoveObstacleShapeButton.svelte'
	import { useObstaclePreviewToggle } from './obstaclePreviewToggle.svelte'

	interface Props extends HTMLAttributes<HTMLDivElement> {
		/** The selected frames. Never empty. */
		entities: readonly Entity[]
		/** How many selected components have no frame, and so are left out of `entities`. */
		framelessCount?: number
	}

	const { entities, framelessCount = 0, ...rest }: Props = $props()

	const environment = useEnvironment()
	const fragmentInfo = useFragmentInfo()
	const configFrames = useConfigFrames()
	const partConfig = usePartConfig()
	// Read here, not in `ObstacleSection`: the details panel portals its content out of this context.
	const obstaclePreview = useObstaclePreviewToggle()

	const frameEditor = new FrameEditor(partConfig.updateFrame, partConfig.deleteFrame)

	const reads = useMappedEntitiesTraits(
		() => entities,
		[
			traits.Name,
			traits.Points,
			traits.Arrows,
			traits.FramesAPI,
			traits.Editable,
			traits.CustomDetails,
			traits.ComplexObstacleShape,
		],
		(entity) => {
			const name = entity.get(traits.Name)
			const isFrame = entity.has(traits.FramesAPI)
			const complexShape = entity.get(traits.ComplexObstacleShape)

			const isFragmentComponentWithVariables =
				name !== undefined &&
				isFrameVariableLocked(fragmentInfo.current?.[name], configFrames.effectiveFrames.get(name))
			const showEditFrameOptions =
				isFrame &&
				entity.has(traits.Editable) &&
				partConfig.hasEditPermissions &&
				!isFragmentComponentWithVariables
			// A geometry on an obstacle's own frame makes rdk ignore attributes.geometries, so only the pose is editable.
			const isObstacle =
				partConfig.current?.components?.some(
					(component) => component.name === name && isObstacleComponent(component)
				) ?? false

			return {
				entity,
				name,
				isFrame,
				hasCustomDetails: entity.has(traits.CustomDetails),
				complexShape,
				isFragmentComponentWithVariables,
				showEditFrameOptions,
				isObstacle,
				showConfigUnavailableWarning:
					isFrame && !partConfig.hasEditPermissions && partConfig.error !== undefined,
				showRelationshipOptions: entity.has(traits.Points) || entity.has(traits.Arrows),
				showObstacleEditor: showEditFrameOptions && isObstacle && !!name,
				// An obstacle is a component whose frame carries its geometries, so it always keeps its frame.
				showDeleteFrame: showEditFrameOptions && environment.current.isStandalone && !isObstacle,
				// A Complex obstacle's shape is edited through its entry in the obstacle's attributes.
				shapeOwner:
					complexShape && partConfig.hasEditPermissions
						? complexShapeOwner(partConfig.current?.components, name)
						: undefined,
				// A part-owned resource's appearance, and that of the frames inside it, is saved to its config while building.
				appearanceTarget:
					partConfig.hasEditPermissions && !isFragmentComponentWithVariables
						? appearanceTargetOf(partConfig.current?.components, name)
						: undefined,
			}
		}
	)

	const isSingle = $derived(entities.length === 1)
	const only = $derived(isSingle ? reads.current[0] : undefined)

	const hasFragmentVariables = $derived(
		reads.current.some((read) => read.isFragmentComponentWithVariables)
	)
	const hasConfigUnavailable = $derived(
		reads.current.some((read) => read.showConfigUnavailableWarning)
	)
	const isAllCustom = $derived(reads.current.every((read) => read.hasCustomDetails))
	const isAnyCustom = $derived(reads.current.some((read) => read.hasCustomDetails))
	const isEditable = $derived(reads.current.every((read) => read.showEditFrameOptions))
	const isPartlyEditable = $derived(
		!isEditable && reads.current.some((read) => read.showEditFrameOptions)
	)
	const hasObstacleEditor = $derived(reads.current.some((read) => read.showObstacleEditor))
	const hasObstacle = $derived(reads.current.some((read) => read.isObstacle))
	const hasShapeOwner = $derived(reads.current.some((read) => !!read.shapeOwner))
	const hasRelationshipOptions = $derived(
		reads.current.some((read) => read.showRelationshipOptions)
	)
	const canDeleteEvery = $derived(reads.current.every((read) => read.showDeleteFrame))
	const canDeleteSome = $derived(
		!canDeleteEvery && reads.current.some((read) => read.showDeleteFrame)
	)
	const hasFrame = $derived(reads.current.some((read) => read.isFrame && read.name !== undefined))

	const hasActions = $derived(
		hasRelationshipOptions || canDeleteEvery || canDeleteSome || hasShapeOwner
	)

	const configAppearanceTargets = $derived(
		reads.current.flatMap(({ entity, appearanceTarget }): ConfigAppearanceTarget[] =>
			appearanceTarget ? [{ entity, ...appearanceTarget }] : []
		)
	)

	const tabs = $derived<DetailsTab[]>(
		isAllCustom
			? [{ id: 'details', label: 'Details', content: detailsTab }]
			: [
					{ id: 'details', label: 'Details', content: detailsTab },
					{ id: 'appearance', label: 'Appearance', content: appearanceTab },
					...(hasFrame
						? [{ id: 'pov', label: 'POV', content: povTab, transparent: isSingle }]
						: []),
				]
	)
</script>

{#snippet geometrySection()}
	{#if only?.showObstacleEditor && only.name}
		<ObstacleSection
			name={only.name}
			preview={obstaclePreview}
		/>
	{:else if hasObstacleEditor}
		<SectionNotice
			label="obstacle"
			message="Select a single obstacle to edit its geometries."
		/>
		<DimensionsDetails {entities} />
	{:else if isEditable && !hasObstacle}
		<EditGeometryDetails {entities} />
	{:else}
		<DimensionsDetails {entities} />
	{/if}
{/snippet}

{#snippet detailsTab()}
	<div class="flex flex-col gap-2.5 pt-3">
		{#if only?.shapeOwner && only.complexShape}
			<ObstacleShapeDetails
				entity={only.entity}
				component={only.shapeOwner}
				index={only.complexShape.index}
			/>
		{:else}
			{#if hasShapeOwner}
				<SectionNotice
					label="obstacle shape"
					message="Select a single obstacle shape to edit it."
				/>
			{/if}

			{#if isPartlyEditable}
				<SectionNotice
					label="editing"
					message="Some selected frames can't be edited here, so these fields are read-only."
				/>
			{/if}

			{#if !isAnyCustom}
				<PoseDetails
					{entities}
					editable={isEditable && !hasShapeOwner}
				/>
			{:else if !isAllCustom}
				<SectionNotice
					label="pose"
					message="Not every selected object shows a pose."
				/>
			{/if}

			{@render geometrySection()}

			<GeometryOffsetDetails {entities} />
		{/if}

		<CountDetails {entities} />
	</div>

	<RelationshipDetails {entities} />

	<DetailsSections
		{entities}
		tab="details"
	/>

	{#if hasActions}
		<h3 class="text-subtle-2 pt-3 pb-2">Actions</h3>
	{/if}

	{#if only?.showRelationshipOptions}
		<AddRelationship entity={only.entity} />
	{:else if hasRelationshipOptions}
		<SectionNotice
			label="add relationship"
			message="Select a single object to add a relationship."
		/>
	{/if}

	{#if canDeleteEvery}
		<Button
			variant="danger"
			class="mt-2 w-full"
			onclick={() => {
				for (const entity of entities) frameEditor.deleteFrame(entity)
			}}
		>
			{isSingle ? 'Delete frame' : `Delete ${entities.length} frames`}
		</Button>
	{:else if canDeleteSome}
		<SectionNotice
			label="delete"
			message="Some selected frames can't be deleted here."
		/>
	{/if}

	{#if only?.shapeOwner && only.complexShape}
		<RemoveObstacleShapeButton
			entity={only.entity}
			component={only.shapeOwner}
			index={only.complexShape.index}
		/>
	{/if}
{/snippet}

{#snippet appearanceTab()}
	{#if configAppearanceTargets.length === entities.length}
		<ConfigAppearanceDetails targets={configAppearanceTargets} />
	{:else if configAppearanceTargets.length === 0}
		<AppearanceDetails {entities} />
	{:else}
		<div class="pt-3">
			<SectionNotice
				label="appearance"
				message="Only some selected objects save their appearance to the config. Select only those, or only the others, to edit it."
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

<DetailsPanel
	{entities}
	{...rest}
>
	{#if hasFragmentVariables || hasConfigUnavailable || framelessCount > 0}
		<div class="bg-extralight px-2">
			{#if hasFragmentVariables}
				<p
					class="mt-2 rounded border-l-4 border-yellow-600 bg-yellow-50 px-2 py-1.5 text-yellow-900"
					data-testid="fragment-variables-warning"
					role="status"
				>
					{#if isSingle}
						This component is from a fragment with variables, editing frames in 3D scene is disabled
					{:else}
						Some selected components are from a fragment with variables, editing their frames in the
						3D scene is disabled
					{/if}
				</p>
			{/if}

			{#if hasConfigUnavailable}
				<div
					class="mt-2 rounded border-l-4 border-yellow-600 bg-yellow-50 px-2 py-1.5 text-yellow-900"
					data-testid="config-unavailable-warning"
					role="status"
				>
					<p>Frame editing is disabled — this machine's configuration could not be read.</p>
					<p class="mt-1 wrap-break-word text-yellow-800">{partConfig.error}</p>
				</div>
			{/if}

			{#if framelessCount > 0}
				<p
					class="text-subtle-1 mt-2"
					role="status"
				>
					{framelessCount === 1
						? "1 selected component has no frame, so it isn't in the scene or shown here."
						: `${framelessCount} selected components have no frame, so they aren't in the scene or shown here.`}
				</p>
			{/if}
		</div>
	{/if}

	<DetailsTabs items={tabs} />
</DetailsPanel>
