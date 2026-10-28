<script>
	import { Canvas } from '@threlte/core/webgpu'
	let { child, ...rest } = $props()

	const Component = $derived(child)
</script>

<Canvas>
	<Component {...rest} />
</Canvas>
