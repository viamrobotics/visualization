<script>
	import { PortalTarget } from '@threlte/extras'

	let { ...rest } = $props()
</script>

<div
	class="absolute top-2 z-4 flex w-full items-center justify-center gap-2"
	{...rest}
>
	<PortalTarget id="dashboard" />
</div>
