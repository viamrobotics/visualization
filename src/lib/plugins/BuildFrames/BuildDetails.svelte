<script lang="ts">
	import type { HTMLAttributes } from 'svelte/elements'

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
	import FramePovTab from '#lib/components/overlay/details/FramePovTab.svelte'
	import GeometryOffsetDetails from '#lib/components/overlay/details/GeometryOffsetDetails.svelte'
	import PoseDetails from '#lib/components/overlay/details/PoseDetails.svelte'
	import RelationshipDetails from '#lib/components/overlay/details/RelationshipDetails.svelte'
	import SectionNotice from '#lib/components/overlay/details/SectionNotice.svelte'
	import { traits, useMappedEntitiesTraits } from '#lib/ecs/index.js'
	import { isFrameVariableLocked } from '#lib/frameVariableLocks.js'
	import { useConfigFrames } from '#lib/hooks/useConfigFrames.svelte.js'
	import { useFragmentInfo } from '#lib/hooks/useFragmentInfo.svelte.js'
	import { usePartConfig } from '#lib/hooks/usePartConfig.svelte.js'
	import { isObstacleComponent } from '#lib/obstacleAttributes.js'

	import ConfigAppearanceDetails, {
		type ConfigAppearanceTarget,
	} from './ConfigAppearanceDetails.svelte'
	import EditPoseDetails from './EditPoseDetails.svelte'
	import DeleteObstacleShapeButton from './ObstacleEditor/DeleteObstacleShapeButton.svelte'
	import DuplicateObstaclesButton from './ObstacleEditor/DuplicateObstaclesButton.svelte'
	import DuplicateObstacleShapeButton from './ObstacleEditor/DuplicateObstacleShapeButton.svelte'
	import ObstacleSection from './ObstacleEditor/ObstacleSection.svelte'
	import ObstacleShapeDetails from './ObstacleEditor/ObstacleShapeDetails.svelte'
	import ObstacleShapesGeometryDetails from './ObstacleEditor/ObstacleShapesGeometryDetails.svelte'
	import ObstacleShapesOffsetDetails from './ObstacleEditor/ObstacleShapesOffsetDetails.svelte'
	import { type SelectedObstacleShape } from './ObstacleEditor/selectedObstacleShapes'
	import { useObstaclePreviewToggle } from './obstaclePreviewToggle.svelte'

	interface Props extends HTMLAttributes<HTMLDivElement> {
		/** The selected frames. Never empty. */
		entities: readonly Entity[]
		/** How many selected components have no frame, and so are left out of `entities`. */
		framelessCount?: number
	}

	const { entities, framelessCount = 0, ...rest }: Props = $props()

	const fragmentInfo = useFragmentInfo()
	const configFrames = useConfigFrames()
	const partConfig = usePartConfig()
	// Read here, not in `ObstacleSection`: the details panel portals its content out of this context.
	const obstaclePreview = useObstaclePreviewToggle()

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
				showDeleteFrame: showEditFrameOptions && !isObstacle,
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
	const canDuplicate = $derived(
		reads.current.every((read) => read.showObstacleEditor && !read.complexShape)
	)
	const canDuplicateSome = $derived(!canDuplicate && hasObstacleEditor)
	const selectedNames = $derived(
		reads.current.flatMap(({ name }) => (name === undefined ? [] : [name]))
	)
	const selectedShapes = $derived(
		reads.current.flatMap(({ entity, shapeOwner, complexShape }): SelectedObstacleShape[] =>
			shapeOwner && complexShape
				? [{ entity, component: shapeOwner, index: complexShape.index }]
				: []
		)
	)
	// Shapes are edited together only when nothing else is selected with them.
	const isAllShapes = $derived(selectedShapes.length === entities.length)

	const hasActions = $derived(
		hasRelationshipOptions ||
			canDeleteEvery ||
			canDeleteSome ||
			isAllShapes ||
			canDuplicate ||
			canDuplicateSome
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
		{:else if isAllShapes}
			<ObstacleShapesOffsetDetails shapes={selectedShapes} />
			<ObstacleShapesGeometryDetails shapes={selectedShapes} />
		{:else}
			{#if hasShapeOwner}
				<SectionNotice
					label="obstacle shape"
					message="Select only obstacle shapes to edit them together."
				/>
			{/if}

			{#if isPartlyEditable}
				<SectionNotice
					label="editing"
					message="Some selected frames can't be edited here, so these fields are read-only."
				/>
			{/if}

			{#if !isAnyCustom && isEditable && !hasShapeOwner}
				<EditPoseDetails {entities} />
			{:else if !isAnyCustom}
				<PoseDetails {entities} />
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

	{#if canDuplicateSome}
		<SectionNotice
			label="duplicate"
			message="Select only obstacles to duplicate them."
		/>
	{/if}

	{#if canDeleteSome}
		<SectionNotice
			label="delete"
			message="Some selected frames can't be deleted here."
		/>
	{/if}

	{#if canDuplicate || canDeleteEvery || isAllShapes}
		<div class="mt-2 flex items-start gap-2">
			{#if canDuplicate}
				<DuplicateObstaclesButton {entities} />
				<button
					type="button"
					class="button button-compact button-danger flex-1"
					onclick={() => partConfig.deleteComponents(selectedNames)}
				>
					{isSingle ? 'Delete obstacle' : `Delete ${entities.length} obstacles`}
				</button>
			{/if}

			{#if isAllShapes}
				<DuplicateObstacleShapeButton shapes={selectedShapes} />
				<DeleteObstacleShapeButton shapes={selectedShapes} />
			{/if}

			{#if canDeleteEvery}
				<button
					type="button"
					class="button button-compact button-danger flex-1"
					onclick={() => partConfig.deleteFrames(selectedNames)}
				>
					{isSingle ? 'Delete frame' : `Delete ${entities.length} frames`}
				</button>
			{/if}
		</div>
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
		<FramePovTab entity={only.entity} />
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
