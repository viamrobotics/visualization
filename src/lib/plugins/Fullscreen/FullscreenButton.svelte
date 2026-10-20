<script lang="ts">
	import { Maximize2, Minimize2 } from 'lucide-svelte'

	import Tooltip from '$lib/components/overlay/Tooltip.svelte'

	interface Props {
		fullscreen: boolean
	}

	let { fullscreen = $bindable() }: Props = $props()

	// Fullscreen overlays the host page; lock its scroll so only the visualizer receives it.
	$effect(() => {
		if (!fullscreen) return

		const { body, documentElement } = document
		const bodyOverflow = body.style.overflow
		const documentOverflow = documentElement.style.overflow

		body.style.overflow = 'hidden'
		documentElement.style.overflow = 'hidden'

		return () => {
			body.style.overflow = bodyOverflow
			documentElement.style.overflow = documentOverflow
		}
	})
</script>

<Tooltip placement="left">
	{#snippet children(tooltipID)}
		<button
			class="border-gray-5 text-gray-8 hover:bg-light active:bg-medium block rounded-md border bg-white p-1.5"
			aria-label={fullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
			aria-pressed={fullscreen}
			aria-describedby={tooltipID}
			onclick={() => (fullscreen = !fullscreen)}
		>
			{#if fullscreen}
				<Minimize2
					size="16"
					aria-hidden="true"
				/>
			{:else}
				<Maximize2
					size="16"
					aria-hidden="true"
				/>
			{/if}
		</button>
	{/snippet}

	{#snippet content()}
		{fullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
	{/snippet}
</Tooltip>
