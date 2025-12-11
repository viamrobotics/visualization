<script lang="ts">
	import type { Entity } from 'koota'
	import { usePortalContext } from './usePortalContext.svelte'
	import { traits, useTrait } from '$lib/ecs'

	interface Props {
		id?: string
		entity?: Entity
	}

	let { id, entity }: Props = $props()

	const name = useTrait(() => entity, traits.Name)
	const resolvedId = $derived(id ?? name.current ?? 'world')
	const portals = usePortalContext()
	const childrenArray = $derived(portals.get(resolvedId))

	$inspect(`resolvedId is ${resolvedId} and has ${childrenArray?.size} children`)
</script>

{#if childrenArray !== undefined}
	{#each childrenArray as children (children)}
		{@render children()}
	{/each}
{/if}
