<!--
@component

The contributed details sections that belong to one tab of the details panel, in
registration order.
-->
<script lang="ts">
	import type { Entity } from 'koota'

	import type { DetailsTabId } from '#lib/hooks/useDetailsSections.svelte.js'

	import { sectionsForTab, useDetailsSections } from '#lib/hooks/useDetailsSections.svelte.js'

	import DetailsSectionTarget from './DetailsSectionTarget.svelte'
	import SectionNotice from './SectionNotice.svelte'

	interface Props {
		entities: readonly Entity[]
		tab: DetailsTabId
	}

	const { entities, tab }: Props = $props()

	const sections = useDetailsSections()

	const visible = $derived(sectionsForTab(sections?.current ?? [], tab))
</script>

{#each visible as section (section)}
	{@const matching = entities.filter((entity) => section.when?.(entity) ?? true)}

	{#if matching.length === entities.length}
		<DetailsSectionTarget
			sectionId={section.id}
			{entities}
		/>
	{:else if matching.length > 0}
		<SectionNotice
			label={section.label}
			message="Not every selected object supports this."
		/>
	{/if}
{/each}
