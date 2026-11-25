<!--
@component

Copies each selected part-owned obstacle in place under a `-copy` name, by button or by Shift+D, then moves the selection to the copies once they reach the scene.
-->
<script lang="ts">
	import type { Entity } from 'koota'

	import { useToast } from '@viamrobotics/prime-ui'

	import Kbd from '#lib/components/overlay/Kbd.svelte'
	import { traits } from '#lib/ecs/index.js'
	import { type PartComponent, usePartConfig } from '#lib/hooks/usePartConfig.svelte.js'
	import { useSelectOnArrival } from '#lib/hooks/useSelectOnArrival.svelte.js'
	import { useHotkey } from '#lib/keybindings/index.js'
	import { isObstacleComponent } from '#lib/obstacleAttributes.js'
	import { nextCopyName } from '#lib/obstacleCopyName.js'

	import { useTakenResourceNames } from '../useTakenResourceNames'

	interface Props {
		/** The selected obstacles' entities. Each one is an editable obstacle the part owns. */
		entities: readonly Entity[]
	}

	const { entities }: Props = $props()

	const partConfig = usePartConfig()
	const takenResourceNames = useTakenResourceNames()
	const toast = useToast()
	const pendingSelection = useSelectOnArrival()

	const label = $derived(
		entities.length === 1 ? 'Duplicate obstacle' : `Duplicate ${entities.length} obstacles`
	)

	const handleDuplicate = () => {
		const components = partConfig.current.components ?? []
		const sources = entities.flatMap((entity): PartComponent[] => {
			const name = entity.get(traits.Name)
			const source = components.find(
				(component) => component.name === name && isObstacleComponent(component)
			)
			return source ? [source] : []
		})
		if (sources.length === 0) return

		const takenNames = takenResourceNames.current
		const copies = sources.map((source) => {
			const name = nextCopyName(takenNames, source.name)
			takenNames.add(name)
			return { ...$state.snapshot(source), name }
		})

		pendingSelection.select(copies.map(({ name }) => name))
		partConfig.createComponents(copies)

		toast.success(
			copies.length === 1
				? `Duplicated ${sources[0]?.name} as ${copies[0]?.name}.`
				: `Duplicated ${copies.length} obstacles.`
		)
	}

	const duplicateKeybinding = useHotkey({
		id: 'editing.duplicateObstacles',
		key: 'd',
		shift: true,
		description: 'Duplicate the selected obstacles',
		group: 'Editing',
		run: handleDuplicate,
	})
</script>

<button
	type="button"
	class="button button-compact flex-1"
	aria-label={label}
	onclick={handleDuplicate}
>
	<div class="flex items-center justify-center gap-2">
		Duplicate
		<Kbd binding={duplicateKeybinding} />
	</div>
</button>
