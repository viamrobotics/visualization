<!--
@component

The contributed details sections that belong to one tab of one entity's card, in
registration order.
-->
<script lang="ts">
	import type { Entity } from 'koota'

	import type { DetailsTabId } from '$lib/hooks/useDetailsSections.svelte'

	import { useDetailsSections } from '$lib/hooks/useDetailsSections.svelte'

	interface Props {
		entity: Entity
		tab: DetailsTabId
	}

	const { entity, tab }: Props = $props()

	const sections = useDetailsSections()

	const visible = $derived(
		(sections?.current ?? []).filter((section) => (section.tab ?? 'details') === tab)
	)
</script>

{#each visible as section (section)}
	{#if section.when?.(entity) ?? true}
		{@render section.snippet({ entity })}
	{/if}
{/each}
