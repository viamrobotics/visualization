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
		/**
		 * The panel edits appearance itself, so sections that replace the built-in appearance
		 * controls are left out instead of showing a second editor.
		 */
		ownsAppearance?: boolean
	}

	const { entities, tab, ownsAppearance = false }: Props = $props()

	const sections = useDetailsSections()

	const visible = $derived(
		sectionsForTab(sections?.current ?? [], tab).filter(
			(section) => !(ownsAppearance && section.replacesAppearance)
		)
	)
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
			message={section.replacesAppearance
				? 'Some selected objects keep their appearance differently. Select only one kind to edit it.'
				: 'Not every selected object supports this.'}
		/>
	{/if}
{/each}
