<script lang="ts">
	import { DEFAULT_ID, usePortalContext } from './usePortalContext.svelte'

	interface Props {
		id?: string
	}

	let { id = DEFAULT_ID }: Props = $props()

	const portals = usePortalContext()
	const childrenArray = $derived(portals.get(id))
</script>

{#if childrenArray !== undefined}
	{#each childrenArray as children (children)}
		{@render children()}
	{/each}
{/if}
