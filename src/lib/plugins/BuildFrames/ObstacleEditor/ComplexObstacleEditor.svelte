<!--
@component

Lists a Complex obstacle's shapes, to add, rename and remove them. A shape's pose and geometry
are edited on its own once selected, from its row here or in the scene. An edit rdk would
reject shows its error and is not written.
-->
<script lang="ts">
	import { Button, IconButton, Input } from '@viamrobotics/prime-core'

	import { selectOnly, traits, useWorld } from '$lib/ecs'
	import { type PartComponent, usePartConfig } from '$lib/hooks/usePartConfig.svelte'
	import { internalFrameName } from '$lib/kinematicsFrames'
	import {
		explicitGeometryLabel,
		obstacleGeometriesOf,
		type ObstacleGeometryConfig,
		obstacleGeometryLabel,
	} from '$lib/obstacleAttributes'
	import { obstacleEditError, type ObstacleEditScope } from '$lib/obstacleEditError'
	import {
		addObstacleGeometry,
		patchObstacleGeometry,
		removeObstacleGeometry,
	} from '$lib/obstacleGeometryList'
	import { validateObstacleGeometries } from '$lib/obstacleGeometryValidation'
	import {
		afterRemovingShape,
		complexObstacleVisualizer,
		type ShapeIndexMove,
		SHAPES_IN_PLACE,
	} from '$lib/obstacleVisualizer'

	interface Props {
		/** A component that `obstacleEditorType` classed as complex. */
		component: PartComponent
	}

	const { component }: Props = $props()

	const world = useWorld()
	const partConfig = usePartConfig()

	const geometries = $derived(obstacleGeometriesOf(component))

	const storedIssues = $derived(validateObstacleGeometries(geometries))

	const isLastShape = $derived(geometries.length <= 1)

	/** A label problem sits under its row, any other under the list. */
	let error = $state<{ rowIndex: number | undefined; message: string } | undefined>()

	/**
	 * Writes `next` when rdk would accept it, preferring a problem with the entry at `index`. Each
	 * shape's saved appearance follows it as `move` says.
	 */
	const commit = (
		next: ObstacleGeometryConfig[],
		index: number | undefined,
		scope: ObstacleEditScope,
		move: ShapeIndexMove
	) => {
		const issue = obstacleEditError(next, index, scope)
		error = issue && {
			rowIndex: issue.scope === 'label' ? index : undefined,
			message: issue.message,
		}
		if (issue) return

		partConfig.updateComponent(component.name, {
			attributes: { ...component.attributes, geometries: next },
			visualizer: complexObstacleVisualizer(component, next, move),
		})
	}

	const handleAdd = () => {
		const next = addObstacleGeometry(geometries).geometries
		commit(next, next.length - 1, 'shape', SHAPES_IN_PLACE)
	}

	const handleRemove = (index: number) => {
		if (isLastShape) return
		commit(removeObstacleGeometry(geometries, index), undefined, 'shape', afterRemovingShape(index))
	}

	const handleRelabel = (index: number, event: FocusEvent) => {
		const entry = geometries[index]
		if (!entry) return

		const draft = (event.target as HTMLInputElement).value
		if (draft === explicitGeometryLabel(entry)) {
			if (error?.rowIndex === index) error = undefined
			return
		}

		const label = draft === '' ? undefined : draft
		commit(patchObstacleGeometry(geometries, index, { label }), index, 'label', SHAPES_IN_PLACE)
	}

	const handleLabelKeydown = (event: KeyboardEvent) => {
		event.stopImmediatePropagation()
		if (event.key === 'Enter') (event.target as HTMLInputElement).blur()
	}

	const handleSelect = (index: number) => {
		const entry = geometries[index]
		if (!entry) return

		const frameName = internalFrameName(component.name, obstacleGeometryLabel(entry, index))
		const shape = world
			.query(traits.ComplexObstacleShape, traits.Name)
			.find((candidate) => candidate.get(traits.Name) === frameName)
		if (shape) selectOnly(world, shape)
	}

	const fieldId = $props.id()
</script>

<div class="flex flex-col gap-2">
	{#if storedIssues.length > 0}
		<ul
			class="text-danger-dark list-disc pl-4 text-xs"
			aria-label="existing geometry problems"
		>
			{#each storedIssues as issue, position (position)}
				<li>
					{issue.index === undefined ? 'Geometries' : `Geometry ${issue.index + 1}`}: {issue.message}
				</li>
			{/each}
		</ul>
	{/if}

	<ul
		class="border-light flex max-h-48 flex-col overflow-y-auto border"
		aria-label="shapes"
	>
		{#each geometries as entry, index (index)}
			{@const label = obstacleGeometryLabel(entry, index)}
			{@const labelError = error?.rowIndex === index ? error.message : undefined}
			{@const labelErrorId = `${fieldId}-${index}-label-error`}
			<li class="flex flex-col gap-0.5 p-1">
				<div class="flex items-center gap-1">
					<div class="min-w-0 flex-1">
						<Input
							value={explicitGeometryLabel(entry)}
							placeholder={label}
							aria-label={`Shape ${index + 1} label`}
							state={labelError ? 'error' : 'none'}
							aria-describedby={labelError ? labelErrorId : undefined}
							on:keydown={handleLabelKeydown}
							on:blur={(event) => handleRelabel(index, event)}
						/>
					</div>
					<IconButton
						icon="chevron-right"
						label={`Select ${label}`}
						variant="ghost"
						cx="shrink-0"
						onclick={() => handleSelect(index)}
					/>
					<IconButton
						icon="trash-can-outline"
						label={`Remove ${label}`}
						title={isLastShape ? 'An obstacle needs at least one geometry' : `Remove ${label}`}
						variant="danger"
						cx="shrink-0"
						disabled={isLastShape}
						onclick={() => handleRemove(index)}
					/>
				</div>
				{#if labelError}
					<p
						id={labelErrorId}
						role="alert"
						class="text-danger-dark text-xs"
					>
						{labelError}
					</p>
				{/if}
			</li>
		{/each}
	</ul>

	<Button
		type="button"
		variant="ghost-outline"
		icon="plus"
		onclick={handleAdd}
	>
		Add shape
	</Button>

	{#if error && error.rowIndex === undefined}
		<p
			role="alert"
			class="text-danger-dark text-xs"
		>
			{error.message}
		</p>
	{/if}
</div>
