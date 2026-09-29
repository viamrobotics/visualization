<!--
@component

Draws each camera's view frustum from its own frame, as a wireframe pinned to the frame's
world pose. Answers where a camera reaches without opening a feed: whether the bin is in
view at this arm pose, whether two wrist cameras leave a blind spot between them.

This is coverage, not sensor simulation — the boundary of what a camera can see, derived
from the intrinsics it reports, with nothing rendered or ray-traced.
-->
<script lang="ts">
	import type { Entity } from 'koota'

	import SettingsPortal from '$lib/components/overlay/Portals/SettingsPortal.svelte'
	import { traits } from '$lib/ecs'
	import { useDetailsSection } from '$lib/hooks/useDetailsSections.svelte'
	import { useFrameEntities } from '$lib/hooks/useFrameEntities.svelte'
	import { useSettings } from '$lib/hooks/useSettings.svelte'

	import CameraFrustum from './CameraFrustum.svelte'
	import SensorCoverageSettings from './SensorCoverageSettings.svelte'
	import SensorCoverageToggle from './SensorCoverageToggle.svelte'
	import { useCameraFrusta } from './useCameraFrusta.svelte'

	const settings = useSettings()

	const frusta = useCameraFrusta({ range: () => settings.current.sensorCoverageRange })

	const cameraNames = $derived(new Set(frusta.names))
	const withIntrinsics = $derived(new Set(frusta.current.map(({ name }) => name)))

	const visible = $derived(
		frusta.current.filter(({ name }) => settings.current.disabledCoverageCameras[name] !== true)
	)

	// A camera's frame carries the camera's own name, which is what resolves a frustum to the
	// frame it hangs off.
	const frameEntities = useFrameEntities()

	const isCameraFrame = (entity: Entity): boolean => {
		if (!entity.has(traits.FramesAPI)) return false

		const name = entity.get(traits.Name)
		return name !== undefined && cameraNames.has(name)
	}

	useDetailsSection({ snippet: coverageRow, when: isCameraFrame, tab: 'appearance' })
</script>

{#snippet coverageRow({ entity }: { entity: Entity })}
	<SensorCoverageToggle
		{entity}
		{withIntrinsics}
	/>
{/snippet}

<SettingsPortal label="Sensors">
	<SensorCoverageSettings
		cameras={frusta.names}
		{withIntrinsics}
	/>
</SettingsPortal>

{#if settings.current.enableSensorCoverage}
	{#each visible as frustum (frustum.name)}
		{@const entity = frameEntities.current.get(frustum.name)}

		<!-- A camera with no frame has no pose to draw from. -->
		{#if entity !== undefined}
			<CameraFrustum
				{entity}
				positions={frustum.positions}
			/>
		{/if}
	{/each}
{/if}
