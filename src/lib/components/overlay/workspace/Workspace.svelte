<script lang="ts">
	import { PortalTarget } from '@threlte/extras'

	import ModeToggle from './ModeToggle.svelte'

	let { ...rest } = $props()
</script>

<div
	class="absolute top-2 right-2 z-4 flex items-center gap-2"
	{...rest}
>
	<ModeToggle />

	<PortalTarget id="workspace" />
</div>
