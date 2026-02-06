<script lang="ts">
	import { useQuery } from '$lib/ecs'
	import { traits } from '$lib/ecs'
	import HoveredEntityTooltip from './HoveredEntityTooltip.svelte'
	import { useSelectedEntity } from '$lib/hooks/useSelection.svelte'
	import { useFocusedEntity } from '$lib/hooks/useSelection.svelte'

	const hoveredEntities = useQuery(traits.Hover)
	const selectedEntity = useSelectedEntity()
	const focusedEntity = useFocusedEntity()

	const displayEntity = $derived(selectedEntity.current ?? focusedEntity.current) // for now, only display hover tooltip if the entity is selected or focused
</script>

{#each hoveredEntities.current as entity (entity)}
	{#if entity === displayEntity}
		<HoveredEntityTooltip hoveredEntity={entity} />
	{/if}
{/each}
