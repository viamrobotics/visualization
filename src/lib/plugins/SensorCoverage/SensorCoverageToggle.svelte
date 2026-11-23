<!--
@component

The coverage row in a camera frame's **Appearance** tab. Contributed by
`<SensorCoverage />`, so the row exists only while the plugin that draws the frustum does.
-->
<script lang="ts">
	import type { Entity } from 'koota'

	import type { IntrinsicsStatus } from '#lib/hooks/useCameraIntrinsics.svelte.js'

	import SharedSwitch from '#lib/components/overlay/details/SharedSwitch.svelte'
	import { sharedValue } from '#lib/components/overlay/details/sharedValue.js'
	import { traits, useMappedEntitiesTraits } from '#lib/ecs/index.js'
	import { useSettings } from '#lib/hooks/useSettings.svelte.js'

	interface Props {
		/** The selected camera frames. */
		entities: readonly Entity[]
		intrinsicsStatus: (camera: string) => IntrinsicsStatus
	}

	const { entities, intrinsicsStatus }: Props = $props()

	const unavailableNotes: Record<Exclude<IntrinsicsStatus, 'ready'>, string> = {
		loading: 'Checking whether this camera reports intrinsics…',
		error: "Couldn't read this camera's properties, so its frustum is unknown.",
		none: 'This camera reports no intrinsics, so its frustum is unknown.',
	}

	const settings = useSettings()

	const names = useMappedEntitiesTraits(
		() => entities,
		[traits.Name],
		(entity) => entity.get(traits.Name)
	)

	const cameras = $derived(names.current.filter((name) => name !== undefined))
	const statuses = $derived(cameras.map((camera) => intrinsicsStatus(camera)))
	const drawable = $derived(cameras.filter((_, index) => statuses[index] === 'ready'))
	const unavailableCount = $derived(cameras.length - drawable.length)

	const isOn = (camera: string) => settings.current.disabledCoverageCameras[camera] !== true

	// Only a camera with a known frustum can draw one, so the others don't count toward the switch.
	const sharedIsOn = $derived(drawable.length > 0 ? sharedValue(drawable.map(isOn)) : false)

	const singleStatus = $derived(cameras.length === 1 ? statuses[0] : undefined)
</script>

{#if cameras.length > 0}
	<div class="flex flex-col gap-1 pt-2.5">
		<SharedSwitch
			label="show coverage"
			value={sharedIsOn}
			disabled={drawable.length === 0}
			onchange={(next) => {
				for (const camera of drawable) settings.current.disabledCoverageCameras[camera] = !next
			}}
		/>

		{#if singleStatus !== undefined && singleStatus !== 'ready'}
			<p class="text-subtle-2">{unavailableNotes[singleStatus]}</p>
		{:else if unavailableCount > 0}
			<p class="text-subtle-2">
				{unavailableCount} of the {cameras.length} selected cameras have no known frustum, so the switch
				leaves them as they are.
			</p>
		{:else if !settings.current.enableSensorCoverage}
			<p class="text-subtle-2">Camera coverage is switched off in the Sensors settings.</p>
		{/if}
	</div>
{/if}
