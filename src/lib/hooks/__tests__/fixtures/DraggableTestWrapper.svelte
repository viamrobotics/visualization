<script lang="ts">
	import { useDraggable } from '../../useDraggable.svelte'

	interface Props {
		name: string
	}

	let { name }: Props = $props()

	const draggable = useDraggable(() => name)
</script>

<div data-testid="status">
	{#if draggable.isLoaded}
		loaded
	{:else}
		loading
	{/if}
</div>

<div data-testid="position">
	{draggable.current.x},{draggable.current.y}
</div>

<div
	data-testid="draggable"
	role="button"
	tabindex="0"
	style:transform="translate({draggable.current.x}px, {draggable.current.y}px)"
	onmousedown={draggable.onDragStart}
	onmouseup={draggable.onDragEnd}
>
	Drag me
</div>
