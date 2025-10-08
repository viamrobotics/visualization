<script lang="ts">
	import { Switch } from '@viamrobotics/prime-core'
	import Drawer from './Drawer.svelte'
	import { useSettings } from '$lib/hooks/useSettings.svelte'

	const settings = useSettings()
</script>

<Drawer
	name="Widgets"
	defaultOpen
>
	<div class="flex h-24 flex-col gap-2 overflow-scroll p-3">
		<div class="flex items-center justify-between gap-4 py-2">
			Arm positions
			<Switch
				bind:on={settings.current.enableArmPositionsWidget}
				on:change={(event) => {
					settings.current.enableArmPositionsWidget = event.detail
				}}
			/>
		</div>
	</div>
</Drawer>
