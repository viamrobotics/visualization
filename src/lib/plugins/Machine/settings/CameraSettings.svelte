<script lang="ts">
	import { Switch } from '@viamrobotics/prime-ui'
	import { useMachineStatus } from '@viamrobotics/svelte-sdk'

	import RefreshRate from '#lib/components/overlay/RefreshRate.svelte'
	import { usePartID } from '#lib/hooks/usePartID.svelte.js'
	import { usePointClouds } from '#lib/hooks/usePointclouds.svelte.js'
	import { RefreshRates, useSettings } from '#lib/hooks/useSettings.svelte.js'

	const settings = useSettings()
	const pointclouds = usePointClouds()
	const partID = usePartID()
	const machineStatus = useMachineStatus(() => partID.current)
	// An empty list means nothing until the machine's first status reply arrives.
	const isWaiting = $derived(partID.current !== '' && machineStatus.current === undefined)

	const { disabledCameras } = $derived(settings.current)
</script>

<div class="flex flex-col gap-1 text-xs">
	<RefreshRate
		id={RefreshRates.pointclouds}
		label="Refresh rate"
		onManualRefetch={() => {
			pointclouds.refetch()
		}}
	/>

	<h3 class="border-gray-3 border-b py-1 text-sm"><strong>Enabled cameras</strong></h3>

	{#each pointclouds.cameras as camera (camera)}
		<div class="flex items-center justify-between py-0.5 text-xs">
			{camera}
			<Switch
				aria-label={camera}
				bind:checked={
					() => disabledCameras[camera] !== true,
					(isEnabled) => {
						disabledCameras[camera] = !isEnabled
					}
				}
			/>
		</div>
	{:else}
		{isWaiting ? 'Waiting for the machine…' : 'No cameras detected'}
	{/each}
</div>
