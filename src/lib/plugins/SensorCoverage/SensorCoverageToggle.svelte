<!--
@component

The coverage row in a camera frame's **Appearance** tab. Contributed by
`<SensorCoverage />`, so the row exists only while the plugin that draws the frustum does.
-->
<script lang="ts">
	import type { Entity } from 'koota'

	import { Switch } from '@viamrobotics/prime-core'

	import { traits, useTrait } from '$lib/ecs'
	import { useSettings } from '$lib/hooks/useSettings.svelte'

	interface Props {
		entity: Entity
		/** Cameras whose reported intrinsics describe a frustum, by name. */
		withIntrinsics: Set<string>
	}

	const { entity, withIntrinsics }: Props = $props()

	const settings = useSettings()

	const name = useTrait(() => entity, traits.Name)

	const cameraName = $derived(name.current)
	const isDrawable = $derived(cameraName !== undefined && withIntrinsics.has(cameraName))
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

		{#if !isDrawable}
			<p class="text-subtle-2">This camera reports no intrinsics, so its frustum is unknown.</p>
		{:else if !settings.current.enableSensorCoverage}
			<p class="text-subtle-2">Camera coverage is switched off in the Sensors settings.</p>
		{/if}
	</div>
{/if}
