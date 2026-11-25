<!--
@component

Contributes a section to the details panel for as long as it is mounted. The content renders
here and moves into the panel, so it reads context from where it is declared. It renders once
with every selected entity the panel describes, and only while a panel shows it.

```svelte
<DetailsSection label="battery" tab="appearance" when={(entity) => entity.has(traits.Battery)}>
	{#snippet children({ entities })}
		<BatteryRows {entities} />
	{/snippet}
</DetailsSection>
```
-->
<script lang="ts">
	import type { Entity } from 'koota'

	import { type Snippet, untrack } from 'svelte'

	import type {
		DetailsTabId,
		RegisteredDetailsSection,
	} from '#lib/hooks/useDetailsSections.svelte.js'

	import {
		detailsSectionPortalId,
		useDetailsSections,
	} from '#lib/hooks/useDetailsSections.svelte.js'

	import DomPortal from '../Portals/DomPortal.svelte'

	interface Props extends Omit<RegisteredDetailsSection, 'id' | 'tab'> {
		tab?: DetailsTabId
		children: Snippet<[{ entities: readonly Entity[] }]>
	}

	const { label, when, tab, replacesAppearance, children }: Props = $props()

	const id = $props.id()
	const sections = useDetailsSections()

	// Registered once, reading the props through getters, so a changed prop keeps the section's place.
	$effect(() =>
		untrack(() =>
			sections.register({
				id,
				get label() {
					return label
				},
				get tab() {
					return tab
				},
				get replacesAppearance() {
					return replacesAppearance
				},
				when: (entity) => when?.(entity) ?? true,
			})
		)
	)

	const entities = $derived(sections.entitiesFor(id))
</script>

{#if entities}
	<DomPortal id={detailsSectionPortalId(id)}>
		{@render children({ entities })}
	</DomPortal>
{/if}
