<!--
@component

The **Sensors** settings tab: the master switch for coverage frusta, how far they reach,
and which cameras draw one.
-->
<script lang="ts">
	import { Input, Switch } from '@viamrobotics/prime-core'
	import { useMachineStatus } from '@viamrobotics/svelte-sdk'

	import { usePartID } from '#lib/hooks/usePartID.svelte.js'
	import { useSettings } from '#lib/hooks/useSettings.svelte.js'

	import type { IntrinsicsStatus } from '#lib/hooks/useCameraIntrinsics.svelte.js'

	interface Props {
		/** Every camera on the part, whether or not it reports usable intrinsics. */
		cameras: string[]
		intrinsicsStatus: (camera: string) => IntrinsicsStatus
	}

	const { cameras, intrinsicsStatus }: Props = $props()

	const statusNotes: Record<IntrinsicsStatus, string | undefined> = {
		loading: 'Checking camera properties…',
		error: "Couldn't read camera properties",
		none: 'No intrinsics reported',
		ready: undefined,
	}

	const settings = useSettings()
	const partID = usePartID()
	const machineStatus = useMachineStatus(() => partID.current)
	// An empty list means nothing until the machine's first status reply arrives.
	const isWaiting = $derived(partID.current !== '' && machineStatus.current === undefined)

	const { disabledCoverageCameras } = $derived(settings.current)
</script>

<div class="flex flex-col gap-1 text-xs">
	<label class="flex items-center justify-between gap-2">
		Camera coverage

		<Switch
			on={settings.current.enableSensorCoverage}
			on:change={(event) => {
				settings.current.enableSensorCoverage = event.detail
			}}
		/>
	</label>

	<p class="text-subtle-2">
		Draws each camera's view frustum from its frame, so you can see what it reaches without opening
		a feed.
	</p>

	<label class="flex items-center justify-between gap-2">
		Range (m)

		<div class="w-20">
			<Input
				type="number"
				min={0}
				bind:value={settings.current.sensorCoverageRange}
				on:keydown={(event) => event.stopImmediatePropagation()}
			/>
		</div>
	</label>

	<p class="text-subtle-2">
		How far out the frustum is drawn. Cameras report no depth range, so this is a display choice.
	</p>

	<h3 class="border-gray-3 border-b py-1 text-sm"><strong>Cameras</strong></h3>

	{#each cameras as camera (camera)}
		{@const note = statusNotes[intrinsicsStatus(camera)]}
		<div class="flex items-center justify-between py-0.5 text-xs">
			<span class="flex flex-col">
				{camera}
				{#if note}
					<span class="text-subtle-2">{note}</span>
				{/if}
			</span>

			<Switch
				on={disabledCoverageCameras[camera] !== true}
				on:change={(event) => {
					disabledCoverageCameras[camera] = !event.detail
				}}
			/>
		</div>
	{:else}
		{isWaiting ? 'Waiting for the machine…' : 'No cameras detected'}
	{/each}
</div>
