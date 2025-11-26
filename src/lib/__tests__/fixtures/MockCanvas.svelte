<script>
	import { Canvas } from '@threlte/core'
	let { child, ...rest } = $props()

	const Component = $derived(child)
</script>

<Canvas>
	<Component {...rest} />
</Canvas>
