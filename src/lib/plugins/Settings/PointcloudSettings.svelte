<script lang="ts">
	import { Input, Switch } from '@viamrobotics/prime-core'
	import { Color } from 'three'

	import RefreshRate from '$lib/components/overlay/RefreshRate.svelte'
	import { usePointClouds } from '$lib/hooks/usePointclouds.svelte'
	import { RefreshRates, useSettings } from '$lib/hooks/useSettings.svelte'

	const settings = useSettings()
	const pointclouds = usePointClouds()

	const { disabledCameras } = $derived(settings.current)

	const colorHex = $derived(`#${new Color(settings.current.pointColor).getHexString()}`)

	const MILLIMETERS_PER_METER = 1000
	const POINT_SIZE_DECIMALS = 3

	const pointSizeMillimeters = $derived(
		Number((settings.current.pointSize * MILLIMETERS_PER_METER).toFixed(POINT_SIZE_DECIMALS))
	)
</script>

<div class="flex flex-col gap-1 text-xs">
	<RefreshRate
		id={RefreshRates.pointclouds}
		label="Refresh rate"
		onManualRefetch={() => {
			pointclouds.refetch()
		}}
	/>

	<label class="flex items-center justify-between gap-2">
		Default point size (mm)

		<div class="w-20">
			<Input
				type="number"
				min={0}
				value={pointSizeMillimeters}
				on:input={(event) => {
					const millimeters = (event.target as HTMLInputElement).valueAsNumber
					if (Number.isFinite(millimeters) && millimeters >= 0) {
						settings.current.pointSize = millimeters / MILLIMETERS_PER_METER
					}
				}}
				on:keydown={(event) => event.stopImmediatePropagation()}
			/>
		</div>
	</label>

	<label class="flex items-center justify-between gap-2">
		Default point color

		<div class="w-20">
			<Input
				type="color"
				value={colorHex}
				on:change={(event) => {
					const value = (event.target as HTMLInputElement).value
					settings.current.pointColor = value
				}}
				on:keydown={(event) => event.stopImmediatePropagation()}
			/>
		</div>
	</label>

	<label class="flex items-center justify-between gap-2">
		Point budget while moving

		<div class="w-20">
			<Input
				type="number"
				bind:value={settings.current.pointBudget}
				on:keydown={(event) => event.stopImmediatePropagation()}
			/>
		</div>
	</label>

	<p class="text-subtle-2">Full detail returns when the camera settles. 0 disables.</p>

	<label class="flex items-center justify-between gap-2">
		Max point size (px)

		<div class="w-20">
			<Input
				type="number"
				min={0}
				bind:value={settings.current.maxPointSize}
				on:keydown={(event) => event.stopImmediatePropagation()}
			/>
		</div>
	</label>

	<h3 class="border-gray-3 border-b py-1 text-sm"><strong>Enabled cameras</strong></h3>

	{#each pointclouds.cameras as camera (camera)}
		<div class="flex items-center justify-between py-0.5 text-xs">
			{camera}
			<Switch
				on={disabledCameras[camera] !== true}
				on:change={(event) => {
					disabledCameras[camera] = !event.detail
				}}
			/>
		</div>
	{:else}
		No cameras detected
	{/each}
</div>
