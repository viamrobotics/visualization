<script lang="ts">
	import { PersistedState } from 'runed'
	import { Icon } from '@viamrobotics/prime-core'
	import type { Snippet } from 'svelte'

	interface Props {
		name: string
		defaultOpen?: boolean
		children: Snippet
	}

	let { name, children, defaultOpen = false }: Props = $props()

	const expanded = $derived(new PersistedState(`${name}-expanded`, defaultOpen))
</script>

<button
	class="border-medium w-full border-t p-2 text-left"
	onclick={() => (expanded.current = !expanded.current)}
>
	<h3 class="text-default flex items-center gap-1.5">
		<Icon
			name={expanded.current ? 'unfold-more-horizontal' : 'unfold-less-horizontal'}
			label="unfold more icon"
			variant="ghost"
			cx="size-6"
			onclick={() => (expanded.current = !expanded.current)}
		/>
		{name}
	</h3>
</button>

{#if expanded.current}
	<div class="border-medium border-t">
		{@render children()}
	</div>
{/if}
