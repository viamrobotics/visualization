<script lang="ts">
	import { useWeblabs } from '$lib/hooks/useWeblabs.svelte'
	import type { Snippet } from 'svelte'

	interface Props {
		experiment: string
		children: Snippet
	}
	let { experiment, children }: Props = $props()

	const { weblab } = useWeblabs()

	$effect.pre(() => {
		weblab.load([experiment])
	})
</script>

{#if weblab.isActive(experiment)}
	{@render children()}
{/if}
