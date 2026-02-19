<script lang="ts">
	import { Switch } from '@viamrobotics/prime-core'
	import Drawer from './Drawer.svelte'
	import { useSettings } from '$lib/hooks/useSettings.svelte'
	import { useResourceByName } from '$lib/hooks/useResourceByName.svelte'
	import { usePartID } from '$lib/hooks/usePartID.svelte'

	const settings = useSettings()
	const resourceByName = useResourceByName()
	const partID = usePartID()

	const cameras = $derived(
		Object.values(resourceByName.current).filter((resource) => resource?.subtype === 'camera')
	)

	const currentRobotCameraWidgets = $derived(
		settings.current.openCameraWidgets[partID.current] || []
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
					{@const isOpen = currentRobotCameraWidgets.includes(camera.name)}
					<div class="flex items-center justify-between gap-4 py-2">
						<span class="min-w-0 truncate">{camera.name}</span>
						<Switch
							on={isOpen}
							on:change={(event) => {
								if (event.detail) {
									settings.current.openCameraWidgets = {
										...settings.current.openCameraWidgets,
										[partID.current]: [...currentRobotCameraWidgets, camera.name],
									}
								} else {
									settings.current.openCameraWidgets = {
										...settings.current.openCameraWidgets,
										[partID.current]: currentRobotCameraWidgets.filter(
											(widget) => widget !== camera.name
										),
									}
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
