<script lang="ts">
	import { relations, useQuery, traits, useWorld } from '$lib/ecs'
	import { useSelectedEntity } from '$lib/hooks/useSelection.svelte'
	import { useFocusedEntity } from '$lib/hooks/useSelection.svelte'
	import HoveredEntity from './HoveredEntity.svelte'
	import LinkedHoveredEntity from './LinkedHoveredEntity.svelte'
	import { onDestroy } from 'svelte'

	const hoveredEntities = useQuery(traits.Hover)
	const world = useWorld()
	const selectedEntity = useSelectedEntity()
	const focusedEntity = useFocusedEntity()

	const displayEntity = $derived(selectedEntity.current ?? focusedEntity.current)
	let linkedEntities = $derived(displayEntity?.targetsFor(relations.HoverLink) ?? [])

	const unsubAdd = world.onAdd(relations.HoverLink, (entity, target) => {
		if (entity === displayEntity) {
			linkedEntities = [...linkedEntities, target]
		}
	})

	const unsubRemove = world.onRemove(relations.HoverLink, (entity, target) => {
		if (entity === displayEntity) {
			linkedEntities = linkedEntities.filter((e) => e !== target)
		}
	})

	onDestroy(() => {
		unsubAdd()
		unsubRemove()
	})
</script>

{#if displayEntity}
	{#each hoveredEntities.current as entity (entity)}
		{#if entity === displayEntity}
			<HoveredEntity hoveredEntity={entity} />
		{/if}
	{/each}

	{#each linkedEntities as entity (entity)}
		<LinkedHoveredEntity
			hoveredEntity={displayEntity}
			linkedEntity={entity}
		/>
	{/each}
{/if}
