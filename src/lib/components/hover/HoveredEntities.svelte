<script lang="ts">
	import { traits, useQuery } from '$lib/ecs'
	import { useLinkedEntities } from '$lib/hooks/useLinked.svelte'

	import HoveredEntity from './HoveredEntity.svelte'
	import HoveredPointMarker from './HoveredPointMarker.svelte'
	import LinkedHoveredEntity from './LinkedHoveredEntity.svelte'

	const linkedEntities = useLinkedEntities()

	const hovered = useQuery(traits.Selected, traits.InstancedMatrix)
</script>

{#each hovered.current as entity (entity)}
	<HoveredPointMarker {entity} />
	<HoveredEntity {entity} />

	{#each linkedEntities.current as linkedEntity (linkedEntity)}
		<LinkedHoveredEntity
			{linkedEntity}
			{entity}
		/>
	{/each}
{/each}
