<script lang="ts">
	import { Switch } from '@viamrobotics/prime-core'

	import RefreshRate from '$lib/components/overlay/RefreshRate.svelte'
	import { usePointcloudObjects } from '$lib/hooks/usePointcloudObjects.svelte'
	import { RefreshRates, useSettings } from '$lib/hooks/useSettings.svelte'

	const settings = useSettings()
	const pointcloudObjects = usePointcloudObjects()
	const { disabledVisionServices } = $derived(settings.current)
</script>

<div class="text-gray-9 flex flex-col gap-1 text-xs">
	<RefreshRate
		id={RefreshRates.vision}
		label="Refresh rate"
		onManualRefetch={() => {
			pointcloudObjects.refetch()
		}}
	/>

	<h3 class="border-gray-3 border-b py-1 text-sm"><strong>Enabled vision services</strong></h3>

	{#each pointcloudObjects.services as visionService (visionService)}
		<div class="flex items-center justify-between py-0.5">
			{visionService}
			<Switch
				on={disabledVisionServices[visionService] !== true}
				on:change={(event) => {
					disabledVisionServices[visionService] = !event.detail
				}}
			/>
		</div>
	{:else}
		No vision services detected
	{/each}
</div>
