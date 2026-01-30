<script lang="ts">
	import { Switch } from '@viamrobotics/prime-core'
	import Drawer from './Drawer.svelte'
	import { useSettings } from '$lib/hooks/useSettings.svelte'
	import { useResourceByName } from '$lib/hooks/useResourceByName.svelte'

	const settings = useSettings()
	const resourceByName = useResourceByName()

	const cameras = $derived(
		Object.values(resourceByName.current).filter((resource) => resource?.subtype === 'camera')
	)
</script>

<Drawer name="Widgets">
	<div class="flex flex-col gap-2 overflow-scroll p-3">
		<div class="flex items-center justify-between gap-4 py-2">
			Arm positions
			<Switch
				bind:on={settings.current.enableArmPositionsWidget}
				on:change={(event) => {
					settings.current.enableArmPositionsWidget = event.detail
				}}
			/>
		</div>

		<div class="mt-4">
			<h3 class="text-sm"><strong>Camera Widgets</strong></h3>
			{#each cameras as camera (camera?.name)}
				{#if camera}
					{@const isOpen = settings.current.openCameraWidgets.includes(camera.name)}
					<div class="flex items-center justify-between gap-4 py-2">
						{camera.name}
						<Switch
							on={isOpen}
							on:change={(event) => {
								if (event.detail) {
									settings.current.openCameraWidgets = [
										...settings.current.openCameraWidgets,
										camera.name,
									]
								} else {
									settings.current.openCameraWidgets = settings.current.openCameraWidgets.filter(
										(widget) => widget !== camera.name
									)
								}
							}}
						/>
					</div>
				{/if}
			{:else}
				<div class="py-2">No cameras detected</div>
			{/each}
		</div>
	</div>
</Drawer>
