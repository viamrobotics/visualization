<script lang="ts">
	import { traits, useTrait } from '$lib/ecs'
	import { useSelectedEntity } from '$lib/hooks/useSelection.svelte'
	import { useFocusedEntity } from '$lib/hooks/useSelection.svelte'
	import HoveredEntity from './HoveredEntity.svelte'
	import LinkedHoveredEntity from './LinkedHoveredEntity.svelte'
	import { useLinkedEntities } from '$lib/hooks/useLinked.svelte'

	const selectedEntity = useSelectedEntity()
	const focusedEntity = useFocusedEntity()
	const linkedEntities = useLinkedEntities()

	const displayEntity = $derived(selectedEntity.current ?? focusedEntity.current)
	const isHovered = useTrait(() => displayEntity, traits.InstancedPose)
</script>

{#if isHovered}
	<HoveredEntity />

	{#each linkedEntities.current as entity (entity)}
		<LinkedHoveredEntity linkedEntity={entity} />
	{/each}
{/if}
