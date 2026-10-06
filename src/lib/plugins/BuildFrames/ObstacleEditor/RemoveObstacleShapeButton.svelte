<!--
@component

Removes a selected Complex obstacle shape and selects its obstacle in its place. An obstacle
keeps at least one shape.
-->
<script lang="ts">
	import type { Entity } from 'koota'

	import { Button } from '@viamrobotics/prime-core'

	import { relations, selectOnly, useTarget, useWorld } from '$lib/ecs'
	import { type PartComponent, usePartConfig } from '$lib/hooks/usePartConfig.svelte'
	import { obstacleGeometriesOf } from '$lib/obstacleAttributes'
	import { obstacleEditError } from '$lib/obstacleEditError'
	import { removeObstacleGeometry } from '$lib/obstacleGeometryList'
	import { afterRemovingShape, complexObstacleVisualizer } from '$lib/obstacleVisualizer'

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
	const obstacle = useTarget(() => entity, relations.ChildOf)

	const geometries = $derived(obstacleGeometriesOf(component))
	const isLastShape = $derived(geometries.length <= 1)

	let error = $state<string | undefined>()

	const handleRemove = () => {
		if (isLastShape) return

		const next = removeObstacleGeometry(geometries, index)
		error = obstacleEditError(next, undefined, 'shape')?.message
		if (error) return

		if (obstacle.current) selectOnly(world, obstacle.current)
		partConfig.updateComponent(component.name, {
			attributes: { ...component.attributes, geometries: next },
			visualizer: complexObstacleVisualizer(component, next, afterRemovingShape(index)),
		})
	}
</script>

<Button
	variant="danger"
	class="mt-2 w-full"
	disabled={isLastShape}
	title={isLastShape ? 'An obstacle needs at least one geometry' : undefined}
	onclick={handleRemove}
>
	Remove shape
</Button>

{#if error}
	<p
		role="alert"
		class="text-danger-dark mt-1 text-xs"
	>
		{error}
	</p>
{/if}
