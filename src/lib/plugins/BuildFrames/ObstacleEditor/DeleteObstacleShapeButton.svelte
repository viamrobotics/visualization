<script lang="ts">
	import type { Entity } from 'koota'

	import { relations, selectOnly, useWorld } from '#lib/ecs/index.js'
	import { obstacleGeometriesOf } from '#lib/obstacleAttributes.js'
	import { removeObstacleGeometries } from '#lib/obstacleGeometryList.js'
	import { afterRemovingShapes } from '#lib/obstacleVisualizer.js'

	import { groupShapesByObstacle, type SelectedObstacleShape } from './selectedObstacleShapes'
	import { useObstacleShapeWrites } from './useObstacleShapeWrites'

	interface Props {
		/** The selected shapes. Never empty. */
		shapes: readonly SelectedObstacleShape[]
	}

	const { shapes }: Props = $props()

	const world = useWorld()
	const shapeWrites = useObstacleShapeWrites()

	const groups = $derived(groupShapesByObstacle(shapes))
	// An obstacle needs at least one shape, so a removal may not take every shape it has.
	const emptiesAnObstacle = $derived(
		groups.some(
			({ component, indices }) => new Set(indices).size >= obstacleGeometriesOf(component).length
		)
	)
	const label = $derived(shapes.length === 1 ? 'Delete shape' : `Delete ${shapes.length} shapes`)

	let error = $state<string | undefined>()

	const handleDelete = () => {
		if (emptiesAnObstacle) return

		const obstacles = new Set(
			shapes.flatMap(({ entity }): Entity[] => {
				const obstacle = entity.targetFor(relations.ChildOf)
				return obstacle ? [obstacle] : []
			})
		)

		error = shapeWrites.write(
			groups.map(({ component, indices }) => {
				const removed = new Set(indices)
				return {
					component,
					next: removeObstacleGeometries(obstacleGeometriesOf(component), removed),
					move: afterRemovingShapes(removed),
				}
			})
		)
		if (!error) selectOnly(world, ...obstacles)
	}
</script>

<div class="flex min-w-0 flex-1 flex-col">
	<button
		type="button"
		class="button button-compact button-danger w-full"
		aria-disabled={emptiesAnObstacle || undefined}
		title={emptiesAnObstacle ? 'An obstacle needs at least one geometry' : undefined}
		onclick={() => {
			if (!emptiesAnObstacle) handleDelete()
		}}
	>
		{label}
	</button>

	{#if error}
		<p
			role="alert"
			class="text-danger-dark mt-1 text-xs"
		>
			{error}
		</p>
	{/if}
</div>
