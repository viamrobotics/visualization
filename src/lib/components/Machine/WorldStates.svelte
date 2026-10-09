<script lang="ts">
	import { usePartID } from '#lib/hooks/usePartID.svelte.js'
	import { useWorldStates } from '#lib/hooks/useWorldState.svelte.js'

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
