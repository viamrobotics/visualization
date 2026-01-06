<script lang="ts">
	import type { Snippet } from 'svelte'

	interface Props {
		children?: Snippet
	}

	const { children }: Props = $props()
</script>

<table class="motion-tools-table">
	{@render children?.()}
</table>

<!-- <style lang="postcss">
	@reference "../../../app.css";

	.motion-tools-table {
		@apply w-full table-auto;
	}
	.motion-tools-table :global(thead) {
		@apply border-light bg-light border;
	}
	.motion-tools-table :global(thead th) {
		@apply border-light text-subtle-1 border px-2.5 py-1 text-xs font-normal whitespace-nowrap;
	}
	.motion-tools-table :global(thead th abbr) {
		@apply text-disabled;
	}

	.motion-tools-table :global(tbody) {
		@apply border-light border;
	}
	.motion-tools-table :global(tbody th) {
		@apply border-light font-roboto-mono text-default h-[40px] gap-2 border px-1.5 text-center text-xs font-normal;
	}
</style> -->
