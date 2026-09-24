<script lang="ts">
	import type { Snippet } from 'svelte'

	interface Props {
		children: Snippet
	}

	// eslint-disable-next-line svelte/no-unused-props -- accepts extra DetailsPanel props
	let { children }: Props & Record<string, unknown> = $props()
</script>

<div data-testid="details-panel">
	{@render children()}
</div>
