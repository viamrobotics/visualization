<script
	module
	lang="ts"
>
	let index = 0
</script>

<script lang="ts">
	import type { Entity } from 'koota'

	import { PressedKeys } from 'runed'
	import { SvelteSet } from 'svelte/reactivity'

	import { traits, useWorld } from '$lib/ecs'
	import { useSelectedEntity } from '$lib/hooks/useSelection.svelte'

	import Frame from './Entities/Frame.svelte'

	const world = useWorld()
	const selectedEntity = useSelectedEntity()

	const entities = new SvelteSet<Entity>()
	const selectedCustomGeometry = $derived(
		[...entities].find((entity) => entity === selectedEntity.current)
	)

	const keys = new PressedKeys()

	keys.onKeys('=', () => {
		const entity = world.spawn(
			traits.Name(`custom geometry ${++index}`),
			traits.Pose,
			traits.Box({ x: 100, y: 100, z: 100 }),
			traits.Removable,
			traits.Transformable
		)

		entities.add(entity)
	})

	keys.onKeys('-', () => {
		if (selectedCustomGeometry) {
			const entity = selectedCustomGeometry
			entity.destroy()
			entities.delete(entity)
			selectedEntity.set()
		}
	})
</script>

{#each entities as entity (entity)}
	<Frame {entity} />
{/each}
