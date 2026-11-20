<!--
@component

The coverage row in a camera frame's **Appearance** tab. Contributed by
`<SensorCoverage />`, so the row exists only while the plugin that draws the frustum does.
-->
<script lang="ts">
	import type { Entity } from 'koota'

	import { Switch } from '@viamrobotics/prime-core'

	import type { IntrinsicsStatus } from '#lib/hooks/useCameraIntrinsics.svelte.js'

	import { traits, useTrait } from '#lib/ecs/index.js'
	import { useSettings } from '#lib/hooks/useSettings.svelte.js'

	interface Props {
		entity: Entity
		intrinsicsStatus: (camera: string) => IntrinsicsStatus
	}

	const { entity, intrinsicsStatus }: Props = $props()

	const unavailableNotes: Record<Exclude<IntrinsicsStatus, 'ready'>, string> = {
		loading: 'Checking whether this camera reports intrinsics…',
		error: "Couldn't read this camera's properties, so its frustum is unknown.",
		none: 'This camera reports no intrinsics, so its frustum is unknown.',
	}

	const settings = useSettings()

	const name = useTrait(() => entity, traits.Name)

	const cameraName = $derived(name.current)
	const status = $derived(cameraName === undefined ? 'loading' : intrinsicsStatus(cameraName))
	const isDrawable = $derived(status === 'ready')
	const isOn = $derived(
		cameraName !== undefined && settings.current.disabledCoverageCameras[cameraName] !== true
	)
</script>

{#if cameraName !== undefined}
	<div class="flex flex-col gap-1 pt-2.5">
		<div class="flex items-center justify-between">
			<strong class="font-semibold">show coverage</strong>

			<Switch
				on={isDrawable && isOn}
				disabled={!isDrawable}
				on:change={(event) => {
					settings.current.disabledCoverageCameras[cameraName] = !event.detail
				}}
			/>
		</div>

		{#if status !== 'ready'}
			<p class="text-subtle-2">{unavailableNotes[status]}</p>
		{:else if !settings.current.enableSensorCoverage}
			<p class="text-subtle-2">Camera coverage is switched off in the Sensors settings.</p>
		{/if}
	</div>
{/if}
