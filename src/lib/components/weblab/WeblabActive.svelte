<script lang="ts">
	import { useWeblabs } from '$lib/hooks/useWeblabs.svelte'
	import type { Snippet } from 'svelte'

	interface Props {
		experiment: string
		renderIfActive: boolean
		children: Snippet
	}
	let { experiment, children, renderIfActive = true }: Props = $props()

	const { weblab } = useWeblabs()

	$effect.pre(() => {
		weblab.load([experiment])
	})
</script>

{#if weblab.isActive(experiment) === renderIfActive}
	{@render children()}
{/if}
