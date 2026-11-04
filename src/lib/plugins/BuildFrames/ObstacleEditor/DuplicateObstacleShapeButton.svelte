<!--
@component

Appends a copy of the selected Complex obstacle shape to its obstacle, by button or by Shift+D, and moves the selection to the copy once its frame appears.
-->
<script lang="ts">
	import { Button } from '@viamrobotics/prime-core'

	import Kbd from '$lib/components/overlay/Kbd.svelte'
	import { selectOnly, traits, useWorld } from '$lib/ecs'
	import { type PartComponent, usePartConfig } from '$lib/hooks/usePartConfig.svelte'
	import { useHotkey } from '$lib/keybindings'
	import { internalFrameName } from '$lib/kinematicsFrames'
	import { obstacleGeometriesOf } from '$lib/obstacleAttributes'
	import { obstacleEditError } from '$lib/obstacleEditError'
	import { duplicateObstacleGeometry } from '$lib/obstacleGeometryList'
	import { complexObstacleVisualizer, SHAPES_IN_PLACE } from '$lib/obstacleVisualizer'

	interface Props {
		/** The Complex obstacle the selected shape belongs to. */
		component: PartComponent
		/** The shape's place in the obstacle's `attributes.geometries`. */
		index: number
	}

	const { component, index }: Props = $props()

	const world = useWorld()
	const partConfig = usePartConfig()

	const geometries = $derived(obstacleGeometriesOf(component))

	let error = $state<string | undefined>()

	/** The frame the copy is drawn as. Its entity takes the selection when it appears. */
	let copiedFrame: string | undefined

	$effect(() => {
		return world.onAdd(traits.Name, (added) => {
			if (copiedFrame === undefined || added.get(traits.Name) !== copiedFrame) return

			copiedFrame = undefined
			selectOnly(world, added)
		})
	})

	const handleDuplicate = () => {
		const { geometries: next, label } = duplicateObstacleGeometry(geometries, index)
		if (label === undefined) return

		error = obstacleEditError(geometries, next, next.length - 1, 'shape')?.message
		if (error) return

		copiedFrame = internalFrameName(component.name, label)
		partConfig.updateComponent(component.name, {
			attributes: { ...component.attributes, geometries: next },
			visualizer: complexObstacleVisualizer(component, next, SHAPES_IN_PLACE),
		})
	}

	const duplicateKeybinding = useHotkey({
		id: 'editing.duplicateObstacleShape',
		key: 'd',
		shift: true,
		description: 'Duplicate the selected obstacle shape',
		group: 'Editing',
		run: handleDuplicate,
	})
</script>

<Button
	class="mt-2 w-full"
	aria-label="Duplicate shape"
	onclick={handleDuplicate}
>
	<div class="flex items-center gap-2">
		Duplicate shape
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
