<script lang="ts">
	import type { Entity } from 'koota'

	import type { DetailsTabId } from '#lib/hooks/useDetailsSections.svelte.js'

	import DetailsSection from '../../DetailsSection.svelte'
	import SelectionDetails from '../../SelectionDetails.svelte'

	interface ContributedSection {
		/** What the section renders, so a test can find it. */
		text: string
		label: string
		when?: (entity: Entity) => boolean
		tab?: DetailsTabId
		replacesAppearance?: boolean
	}

	interface Props {
		entities: readonly Entity[]
		sections?: ContributedSection[]
	}

	const { entities, sections = [] }: Props = $props()
</script>

{#each sections as section (section.text)}
	<DetailsSection
		label={section.label}
		when={section.when}
		tab={section.tab}
		replacesAppearance={section.replacesAppearance}
	>
		{#snippet children()}
			<p>{section.text}</p>
		{/snippet}
	</DetailsSection>
{/each}

<SelectionDetails {entities} />
