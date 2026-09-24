<script lang="ts">
	import type { Snippet } from 'svelte'

	interface Props {
		title?: string
		isOpen?: boolean
		children: Snippet
	}

	// eslint-disable-next-line svelte/no-unused-props -- accepts extra FloatingPanel props
	let {
		title = '',
		isOpen = $bindable(false),
		children,
	}: Props & Record<string, unknown> = $props()
</script>

<div data-testid="floating-panel">
	{#if title}
		<h3>{title}</h3>
	{/if}

	<button
		aria-label="Close panel"
		onclick={() => (isOpen = false)}
	>
		close
	</button>

	{#if isOpen}
		{@render children()}
	{/if}
</div>
