<!--
@component

Where `<DomPortal>` content with the same `id` lands.
-->
<script lang="ts">
	import { useDomPortals } from '#lib/portal.svelte.js'

	interface Props {
		id: string
	}

	const { id }: Props = $props()

	const portals = useDomPortals()
</script>

<!-- `contents`, so whatever lands here lays out as children of this target's parent. -->
<div
	class="contents"
	{@attach (element) => portals.register(id, element)}
></div>
