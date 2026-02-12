<script lang="ts">
	import Drawer from './Drawer.svelte'
	import XRControllerSettings from '$lib/components/xr/XRControllerSettings.svelte'
</script>

<Drawer name="XR">
	<div class="flex h-100 flex-col gap-2 overflow-scroll p-3">
		<XRControllerSettings />
	</div>
</Drawer>
