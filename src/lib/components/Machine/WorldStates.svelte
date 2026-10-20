<script lang="ts">
	import { usePartID } from '$lib/hooks/usePartID.svelte'
	import { useWorldStates } from '$lib/hooks/useWorldState.svelte'

	import WorldState from './WorldState.svelte'

	const partID = usePartID()
	const worldStates = useWorldStates()
</script>

{#each worldStates.stores as name (`${partID.current}:${name}`)}
	<WorldState
		partID={partID.current}
		{name}
	/>
{/each}
