<script lang="ts">
	import { useQuery, traits } from '$lib/ecs'
	import { useSelectedEntity } from '$lib/hooks/useSelection.svelte'
	import { useFocusedEntity } from '$lib/hooks/useSelection.svelte'
	import HoveredEntity from './HoveredEntity.svelte'
	import LinkedHoveredEntity from './LinkedHoveredEntity.svelte'
	import { useHoveredLinkedEntities } from '$lib/hooks/useHoverLinked.svelte'

	const hoveredEntities = useQuery(traits.Hover)
	const selectedEntity = useSelectedEntity()
	const focusedEntity = useFocusedEntity()
	const hoveredLinkedEntities = useHoveredLinkedEntities()

	const displayEntity = $derived(selectedEntity.current ?? focusedEntity.current)
</script>

{#if displayEntity}
	{#each hoveredEntities.current as entity (entity)}
		{#if entity === displayEntity}
			<HoveredEntity hoveredEntity={entity} />
		{/if}
	{/each}

	{#each hoveredLinkedEntities.current as entity (entity)}
		<LinkedHoveredEntity
			hoveredEntity={displayEntity}
			linkedEntity={entity}
		/>
	{/each}
{/if}
