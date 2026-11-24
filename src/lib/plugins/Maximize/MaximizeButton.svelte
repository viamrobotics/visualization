<script lang="ts">
	import { Tooltip } from '@viamrobotics/prime-ui'
	import { Maximize2, Minimize2 } from 'lucide-svelte'

	interface Props {
		maximized: boolean
	}

	let { maximized = $bindable() }: Props = $props()

	// A maximized visualizer overlays the host page, so the page's scroll is locked and only the visualizer receives it.
	$effect(() => {
		if (!maximized) return

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

<Tooltip>
	<Tooltip.Trigger>
		<button
			class="border-gray-5 text-gray-8 hover:bg-light active:bg-medium block rounded-md border bg-white p-1.5"
			aria-label={maximized ? 'Restore' : 'Maximize'}
			aria-pressed={maximized}
			onclick={() => (maximized = !maximized)}
		>
			{#if maximized}
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
	</Tooltip.Trigger>
	<Tooltip.Content side="left">
		{maximized ? 'Restore' : 'Maximize'}
	</Tooltip.Content>
</Tooltip>
