<script lang="ts">
	import type { Entity } from 'koota'

	import DetailsSection from '../../DetailsSection.svelte'
	import DetailsSections from '../../DetailsSections.svelte'

	interface Props {
		entities: readonly Entity[]
		ownsAppearance: boolean
	}

	const { entities, ownsAppearance }: Props = $props()
</script>

<DetailsSection
	label="appearance"
	tab="appearance"
	replacesAppearance
>
	<p>session appearance</p>
</DetailsSection>

<DetailsSection
	label="show coverage"
	tab="appearance"
>
	<p>coverage toggle</p>
</DetailsSection>

<DetailsSections
	{entities}
	tab="appearance"
	{ownsAppearance}
/>
