<script lang="ts">
	import { useResizable } from '../../useResizable.svelte'

	interface Props {
		name: string
	}

	let { name }: Props = $props()

	const resizable = useResizable(() => name)

	let container = $state<HTMLDivElement>()

	$effect(() => {
		if (container) {
			resizable.observe(container)
		}
	})
</script>

<div data-testid="status">
	{#if resizable.isLoaded}
		loaded
	{:else}
		loading
	{/if}
</div>

<div data-testid="dimensions">
	{resizable.current.width}x{resizable.current.height}
</div>

<div
	bind:this={container}
	data-testid="container"
	class="resize"
	style:width={`${resizable.current.width}px`}
	style:height={`${resizable.current.height}px`}
>
	Resizable container
</div>
