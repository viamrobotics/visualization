<!--
@component

Appends a copy of each selected Complex obstacle shape to its obstacle, by button or by Shift+D, then moves the selection to the copies once their frames reach the scene.
-->
<script lang="ts">
	import { Button } from '@viamrobotics/prime-core'

	import Kbd from '#lib/components/overlay/Kbd.svelte'
	import { useSelectOnArrival } from '#lib/hooks/useSelectOnArrival.svelte.js'
	import { useHotkey } from '#lib/keybindings/index.js'
	import { internalFrameName } from '#lib/kinematicsFrames.js'
	import { obstacleGeometriesOf } from '#lib/obstacleAttributes.js'
	import { duplicateObstacleGeometries } from '#lib/obstacleGeometryList.js'
	import { SHAPES_IN_PLACE } from '#lib/obstacleVisualizer.js'

	import { groupShapesByObstacle, type SelectedObstacleShape } from './selectedObstacleShapes'
	import { useObstacleShapeWrites } from './useObstacleShapeWrites'

	interface Props {
		/** The selected shapes. Never empty. */
		shapes: readonly SelectedObstacleShape[]
	}

	const { shapes }: Props = $props()

	const writeShapes = useObstacleShapeWrites()
	const selectOnArrival = useSelectOnArrival()

	const label = $derived(
		shapes.length === 1 ? 'Duplicate shape' : `Duplicate ${shapes.length} shapes`
	)

	let error = $state<string | undefined>()

	const handleDuplicate = () => {
		const copies = groupShapesByObstacle(shapes).map(({ component, indices }) => ({
			component,
			...duplicateObstacleGeometries(obstacleGeometriesOf(component), indices),
		}))

		const frameNames = copies.flatMap(({ component, labels }) =>
			labels.map((copyLabel) => internalFrameName(component.name, copyLabel))
		)
		selectOnArrival(frameNames)

		error = writeShapes(
			copies.map(({ component, geometries }) => ({
				component,
				next: geometries,
				move: SHAPES_IN_PLACE,
			}))
		)
		if (error) selectOnArrival([])
	}

	const duplicateKeybinding = useHotkey({
		id: 'editing.duplicateObstacleShape',
		key: 'd',
		shift: true,
		description: 'Duplicate the selected obstacle shapes',
		group: 'Editing',
		run: handleDuplicate,
	})
</script>

<div class="flex min-w-0 flex-1 flex-col">
	<Button
		class="w-full"
		aria-label={label}
		onclick={handleDuplicate}
	>
		<div class="flex items-center justify-center gap-2">
			Duplicate
			<Kbd binding={duplicateKeybinding} />
		</div>
	</Button>

	{#if error}
		<p
			role="alert"
			class="text-danger-dark mt-1 text-xs"
		>
			{error}
		</p>
	{/if}
</div>
