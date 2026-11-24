<script lang="ts">
	import type { Snippet } from 'svelte'

	import DomPortal from './DomPortal.svelte'

	interface Props {
		children: Snippet
	}

	let { children }: Props = $props()
</script>

<DomPortal id="mode-toggle">
	{@render children()}
</DomPortal>
