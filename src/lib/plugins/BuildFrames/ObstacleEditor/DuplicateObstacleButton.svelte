<!--
@component

Adds a copy of the selected part-owned obstacle to the config, by button or by Shift+D, and moves the selection to the copy once its frame appears.
-->
<script lang="ts">
	import { Button } from '@viamrobotics/prime-core'

	import Kbd from '$lib/components/overlay/Kbd.svelte'
	import { duplicateObstacleComponent } from '$lib/duplicateObstacleComponent'
	import { selectOnly, traits, useWorld } from '$lib/ecs'
	import { useFragmentInfo } from '$lib/hooks/useFragmentInfo.svelte'
	import { type PartComponent, usePartConfig } from '$lib/hooks/usePartConfig.svelte'
	import { useHotkey } from '$lib/keybindings'

	interface Props {
		/** The selected obstacle. */
		component: PartComponent
	}

	const { component }: Props = $props()

	const world = useWorld()
	const partConfig = usePartConfig()
	const fragmentInfo = useFragmentInfo()

	/** A copy's name is unique across the part's own components and its fragments' components. */
	const takenNames = $derived([
		...(partConfig.current?.components ?? []).map(({ name }) => name),
		...Object.keys(fragmentInfo.current ?? {}),
	])

	/** The copy the frame reconciler owes us an entity for. Its entity takes the selection when it appears. */
	let pendingName: string | undefined

	$effect(() => {
		return world.onAdd(traits.Name, (added) => {
			if (pendingName === undefined || added.get(traits.Name) !== pendingName) return

			pendingName = undefined
			selectOnly(world, added)
		})
	})

	const handleDuplicate = () => {
		// The snapshot is the plain config: a reactive proxy around a prop cannot be cloned.
		const copy = duplicateObstacleComponent($state.snapshot(component), takenNames)
		pendingName = copy.name
		partConfig.createComponent(copy)
	}

	const duplicateKeybinding = useHotkey({
		id: 'editing.duplicateObstacle',
		key: 'd',
		shift: true,
		description: 'Duplicate the selected obstacle',
		group: 'Editing',
		run: handleDuplicate,
	})
</script>

<Button
	class="mt-2 w-full"
	aria-label="Duplicate obstacle"
	onclick={handleDuplicate}
>
	<div class="flex items-center gap-2">
		Duplicate obstacle
		<Kbd binding={duplicateKeybinding} />
	</div>
</Button>
