<!--
@component

Renders a keyboard shortcut as one chip per key. Used wherever a shortcut is shown.
-->
<script lang="ts">
	import type { Keybinding } from '$lib/keybindings'

	import { keybindingParts } from '$lib/keybindings'

	interface Props {
		binding: Keybinding
	}

	let { binding }: Props = $props()

	const parts = $derived(keybindingParts(binding))
</script>

<kbd class="inline-flex items-center gap-0.5">
	{#each parts as part (part)}
		<kbd
			class="pointer-events-none inline-flex h-4 min-w-4 items-center justify-center rounded-xs border border-current/20 px-0.5 pt-px font-sans text-[11px] text-current/60 select-none"
		>
			{part}
		</kbd>
	{/each}
</kbd>
