<script lang="ts">
	import { HTML } from '@threlte/extras'

	import { useSettings } from '$lib/hooks/useSettings.svelte'

	interface Props {
		text?: string
	}

	let { text }: Props = $props()

	const settings = useSettings()

	const labels = $derived(settings.current.enableLabels)
</script>

{#if labels && text}
	<HTML
		center
		zIndexRange={[3, 0]}
		class="border-gray-7 border bg-white px-2 py-1 text-xs"
	>
		{text}
	</HTML>
{/if}
