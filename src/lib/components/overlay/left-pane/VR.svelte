<script lang="ts">
	import Drawer from './Drawer.svelte'
	import VRControllerSettings from '$lib/components/settings/VRControllerSettings.svelte'
</script>

<Drawer name="VR">
	<div class="flex h-100 flex-col gap-2 overflow-scroll p-3">
		<VRControllerSettings />
	</div>
</Drawer>
