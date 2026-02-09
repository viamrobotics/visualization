<script lang="ts">
	import { relations, useQuery, traits } from '$lib/ecs'
	import { useSelectedEntity } from '$lib/hooks/useSelection.svelte'
	import { useFocusedEntity } from '$lib/hooks/useSelection.svelte'
	import HoveredEntity from './HoveredEntity.svelte'
	import LinkedHoveredEntity from './LinkedHoveredEntity.svelte'

	const hoveredEntities = useQuery(traits.Hover)
	const selectedEntity = useSelectedEntity()
	const focusedEntity = useFocusedEntity()

	const displayEntity = $derived(selectedEntity.current ?? focusedEntity.current)
	const linkedEntities = $derived(displayEntity?.targetsFor(relations.HoverLink) ?? [])
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
