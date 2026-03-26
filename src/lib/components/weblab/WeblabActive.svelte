<script lang="ts">
	import type { Snippet } from 'svelte'

	import { useWeblabs } from '$lib/hooks/useWeblabs.svelte'

	interface Props {
		experiment: string
		renderIfActive?: boolean
		children: Snippet
	}
	let { experiment, children, renderIfActive = true }: Props = $props()

	const weblabs = useWeblabs()

	$effect(() => {
		weblabs.load([experiment])
	})
</script>

{#if weblabs.isActive(experiment) === renderIfActive}
	{@render children()}
{/if}
