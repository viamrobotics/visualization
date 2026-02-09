<script lang="ts">
	import { traits, useTrait } from '$lib/ecs'
	import { useSelectedEntity } from '$lib/hooks/useSelection.svelte'
	import { useFocusedEntity } from '$lib/hooks/useSelection.svelte'
	import HoveredEntity from './HoveredEntity.svelte'
	import LinkedHoveredEntity from './LinkedHoveredEntity.svelte'
	import { useHoveredLinkedEntities } from '$lib/hooks/useHoverLinked.svelte'

	const selectedEntity = useSelectedEntity()
	const focusedEntity = useFocusedEntity()
	const hoveredLinkedEntities = useHoveredLinkedEntities()

	const displayEntity = $derived(selectedEntity.current ?? focusedEntity.current)
	const isHovered = useTrait(() => displayEntity, traits.Hover)
</script>

{#if isHovered}
	<HoveredEntity />

	{#each hoveredLinkedEntities.current as entity (entity)}
		<LinkedHoveredEntity linkedEntity={entity} />
	{/each}
{/if}
