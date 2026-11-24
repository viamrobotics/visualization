<!--
@component

Where one `<DetailsSection>`'s content lands in the panel, shown for `entities`.
-->
<script lang="ts">
	import type { Entity } from 'koota'

	import {
		detailsSectionPortalId,
		useDetailsSections,
	} from '#lib/hooks/useDetailsSections.svelte.js'

	import DomPortalTarget from '../Portals/DomPortalTarget.svelte'

	interface Props {
		sectionId: string
		entities: readonly Entity[]
	}

	const { sectionId, entities }: Props = $props()

	const sections = useDetailsSections()

	$effect(() => sections.show(sectionId, entities))
</script>

<DomPortalTarget id={detailsSectionPortalId(sectionId)} />
