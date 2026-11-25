<script lang="ts">
	import { traits, useFolder } from '#lib/ecs/index.js'
	import { usePartID } from '#lib/hooks/usePartID.svelte.js'
	import { useWorldStates } from '#lib/hooks/useWorldState.svelte.js'

	import WorldState from './WorldState.svelte'

	const partID = usePartID()
	const worldStates = useWorldStates()

	useFolder({
		id: 'world-state-store',
		name: 'World state store',
		order: 400,
		sources: [traits.WorldStateStoreAPI],
	})
</script>

{#each worldStates.stores as name (`${partID.current}:${name}`)}
	<WorldState
		partID={partID.current}
		{name}
	/>
{/each}
