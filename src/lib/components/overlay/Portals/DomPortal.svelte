<!--
@component

Moves its children into the `<DomPortalTarget>` with the same `id`, through `domPortal`. The
children read context from where they are declared, not from the target. Renders nothing until
the target has mounted.
-->
<script lang="ts">
	import type { Snippet } from 'svelte'

	import { domPortal, useDomPortals } from '#lib/portal.svelte.js'

	interface Props {
		id: string
		children: Snippet
	}

	const { id, children }: Props = $props()

	const portals = useDomPortals()
	const target = $derived(portals.get(id))
</script>

<!-- Svelte no longer owns the moved element's position, so `domPortal`'s cleanup is what removes it. -->
{#if target}
	<div
		class="contents"
		{@attach domPortal(target)}
	>
		{@render children()}
	</div>
{/if}
