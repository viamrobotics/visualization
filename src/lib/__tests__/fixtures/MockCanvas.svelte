<script>
	import { Canvas } from '@threlte/core'
	let { child, ...rest } = $props()
</script>

<Canvas>
	<svelte:component
		this={child}
		{...rest}
	/>
</Canvas>
