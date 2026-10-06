<!--
@component

Edits one shape of a Complex obstacle once that shape is selected: its label, its offset from
the obstacle's frame, and its geometry. An edit rdk would reject shows its error and is not
written.
-->
<script lang="ts">
	import type { Entity } from 'koota'

	import { Input } from '@viamrobotics/prime-core'
	import { Matrix4 } from 'three'

	import type { Frame } from '$lib/frame'

	import GeometryFields from '$lib/components/overlay/details/GeometryFields.svelte'
	import PoseFields from '$lib/components/overlay/details/PoseFields.svelte'
	import WorldPoseDetails from '$lib/components/overlay/details/WorldPoseDetails.svelte'
	import EntityLink from '$lib/components/overlay/EntityLink.svelte'
	import { type EditableFrameGeometry } from '$lib/defaultFrameGeometry'
	import { relations, selectOnly, traits, useTarget, useTrait, useWorld } from '$lib/ecs'
	import { type PartComponent, usePartConfig } from '$lib/hooks/usePartConfig.svelte'
	import { internalFrameName } from '$lib/kinematicsFrames'
	import { Pose } from '$lib/math'
	import {
		explicitGeometryLabel,
		obstacleGeometriesOf,
		type ObstacleGeometryConfig,
		obstacleGeometryLabel,
		type ObstacleShape,
	} from '$lib/obstacleAttributes'
	import {
		type ObstacleEditError,
		obstacleEditError,
		type ObstacleEditScope,
	} from '$lib/obstacleEditError'
	import { type ObstacleGeometryPatch, patchObstacleGeometry } from '$lib/obstacleGeometryList'
	import { validateObstacleGeometries } from '$lib/obstacleGeometryValidation'
	import { complexObstacleVisualizer, SHAPES_IN_PLACE } from '$lib/obstacleVisualizer'

	interface Props {
		/** The shape's own frame entity. */
		entity: Entity
		/** The Complex obstacle the shape belongs to. */
		component: PartComponent
		/** The shape's place in the obstacle's `attributes.geometries`. */
		index: number
	}

	const { entity, component, index }: Props = $props()

	const world = useWorld()
	const partConfig = usePartConfig()

	const worldMatrix = useTrait(() => entity, traits.WorldMatrix)
	const center = useTrait(() => entity, traits.Center)
	const obstacle = useTarget(() => entity, relations.ChildOf)

	const geometries = $derived(obstacleGeometriesOf(component))
	const shape = $derived<ObstacleGeometryConfig | undefined>(geometries[index])
	const storedIssues = $derived(
		validateObstacleGeometries(geometries).filter((issue) => issue.index === index)
	)

	const tempWorld = new Matrix4()
	const tempCenter = new Matrix4()

	// The shape's frame sits at the obstacle's origin, and its geometry carries the offset.
	const worldPose = $derived.by<Pose | undefined>(() => {
		if (!worldMatrix.current) return undefined
		tempWorld.copy(worldMatrix.current)
		if (center.current) tempWorld.multiply(new Pose().copy(center.current).toMatrix4(tempCenter))
		return new Pose().setFromMatrix4(tempWorld)
	})

	let error = $state<ObstacleEditError | undefined>()

	let labelDraft = $derived(shape ? explicitGeometryLabel(shape) : '')

	/** The frame a relabel renames this shape to. Its entity replaces this one, so the selection follows it. */
	let renamedFrame: string | undefined

	$effect(() => {
		return world.onAdd(traits.Name, (added) => {
			if (renamedFrame === undefined || added.get(traits.Name) !== renamedFrame) return

			renamedFrame = undefined
			selectOnly(world, added)
		})
	})

	/** Writes the shape with `patch` applied when rdk would accept it. Returns whether it wrote. */
	const commit = (patch: ObstacleGeometryPatch, scope: ObstacleEditScope): boolean => {
		const next = patchObstacleGeometry(geometries, index, patch)
		error = obstacleEditError(next, index, scope)
		if (error) return false

		partConfig.updateComponent(component.name, {
			attributes: { ...component.attributes, geometries: next },
			visualizer: complexObstacleVisualizer(component, next, SHAPES_IN_PLACE),
		})
		return true
	}

	const handleRelabel = () => {
		if (!shape) return
		if (labelDraft === explicitGeometryLabel(shape)) {
			if (error?.scope === 'label') error = undefined
			return
		}

		const label = labelDraft === '' ? undefined : labelDraft
		renamedFrame = internalFrameName(
			component.name,
			obstacleGeometryLabel({ ...shape, label }, index)
		)
		if (!commit({ label }, 'label')) renamedFrame = undefined
	}

	const handleLabelKeydown = (event: KeyboardEvent) => {
		event.stopImmediatePropagation()
		if (event.key === 'Enter') (event.target as HTMLInputElement).blur()
	}

	const handlePoseChange = (pose: Pick<Frame, 'translation' | 'orientation'>) => {
		commit({ translation: pose.translation, orientation: pose.orientation }, 'shape')
	}

	const handleShapeChange = (geometry: EditableFrameGeometry) => {
		if (geometry.type === 'none') return
		commit(geometry as ObstacleShape, 'shape')
	}

	const fieldId = $props.id()
	const labelFieldId = `${fieldId}-shape-label`
	const labelErrorId = `${fieldId}-label-error`
</script>

<WorldPoseDetails pose={worldPose} />

<div>
	<strong class="font-semibold">parent frame</strong>
	<div class="mt-0.5 flex gap-3">
		{#if obstacle.current}
			<EntityLink entity={obstacle.current} />
		{:else}
			{component.name}
		{/if}
	</div>
</div>

<div class="flex flex-col gap-0.5">
	<label
		for={labelFieldId}
		class="font-semibold"
	>
		label
	</label>
	<Input
		id={labelFieldId}
		bind:value={labelDraft}
		state={error?.scope === 'label' ? 'error' : 'none'}
		aria-describedby={error?.scope === 'label' ? labelErrorId : undefined}
		on:keydown={handleLabelKeydown}
		on:blur={handleRelabel}
	/>
	{#if error?.scope === 'label'}
		<p
			id={labelErrorId}
			role="alert"
			class="text-danger-dark text-xs"
		>
			{error.message}
		</p>
	{/if}
</div>

{#if shape}
	<PoseFields
		translation={shape.translation}
		orientation={shape.orientation}
		onchange={handlePoseChange}
	/>

	<GeometryFields
		geometry={shape}
		includeNone={false}
		onchange={handleShapeChange}
	/>
{/if}

{#if storedIssues.length > 0}
	<ul
		class="text-danger-dark list-disc pl-4 text-xs"
		aria-label="existing shape problems"
	>
		{#each storedIssues as issue, position (position)}
			<li>{issue.message}</li>
		{/each}
	</ul>
{/if}

{#if error?.scope === 'shape'}
	<p
		role="alert"
		class="text-danger-dark text-xs"
	>
		{error.message}
	</p>
{/if}
