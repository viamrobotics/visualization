<script lang="ts">
	import { NumberField } from '@viamrobotics/prime-controls'
	import { Input, Switch } from '@viamrobotics/prime-ui'
	import { useMachineStatus } from '@viamrobotics/svelte-sdk'
	import { Color } from 'three'

	import RefreshRate from '#lib/components/overlay/RefreshRate.svelte'
	import { usePartID } from '#lib/hooks/usePartID.svelte.js'
	import { usePointClouds } from '#lib/hooks/usePointclouds.svelte.js'
	import { RefreshRates, useSettings } from '#lib/hooks/useSettings.svelte.js'

	const settings = useSettings()
	const uid = $props.id()
	const pointclouds = usePointClouds()
	const partID = usePartID()
	const machineStatus = useMachineStatus(() => partID.current)
	// An empty list means nothing until the machine's first status reply arrives.
	const isWaiting = $derived(partID.current !== '' && machineStatus.current === undefined)

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

	<div class="flex items-center justify-between gap-2">
		<label
			id="{uid}-point-size-label"
			for="{uid}-point-size"
		>
			Default point size (mm)
		</label>

		<div class="w-20">
			<NumberField
				id="{uid}-point-size"
				aria-labelledby="{uid}-point-size-label"
				min={0}
				bind:value={
					() => pointSizeMillimeters,
					(millimeters) => {
						if (millimeters !== undefined && Number.isFinite(millimeters) && millimeters >= 0) {
							settings.current.pointSize = millimeters / MILLIMETERS_PER_METER
						}
					}
				}
				onkeydown={(event) => event.stopImmediatePropagation()}
			/>
		</div>
	</div>

	<label class="flex items-center justify-between gap-2">
		Default point color

		<div class="w-20">
			<Input
				type="color"
				class="input-compact w-full"
				value={colorHex}
				onchange={(event) => {
					settings.current.pointColor = event.currentTarget.value
				}}
				onkeydown={(event) => event.stopImmediatePropagation()}
			/>
		</div>
	</label>

	<div class="flex items-center justify-between gap-2">
		<label
			id="{uid}-point-budget-label"
			for="{uid}-point-budget"
		>
			Point budget while moving
		</label>

		<div class="w-20">
			<NumberField
				id="{uid}-point-budget"
				aria-labelledby="{uid}-point-budget-label"
				bind:value={
					() => settings.current.pointBudget,
					(budget) => {
						if (budget !== undefined) settings.current.pointBudget = budget
					}
				}
				onkeydown={(event) => event.stopImmediatePropagation()}
			/>
		</div>
	</div>

	<p class="text-subtle-2">Full detail returns when the camera settles. 0 disables.</p>

	<div class="flex items-center justify-between gap-2">
		<label
			id="{uid}-max-point-size-label"
			for="{uid}-max-point-size"
		>
			Max point size (px)
		</label>

		<div class="w-20">
			<NumberField
				id="{uid}-max-point-size"
				aria-labelledby="{uid}-max-point-size-label"
				min={0}
				bind:value={
					() => settings.current.maxPointSize,
					(size) => {
						if (size !== undefined) settings.current.maxPointSize = size
					}
				}
				onkeydown={(event) => event.stopImmediatePropagation()}
			/>
		</div>
	</div>

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
