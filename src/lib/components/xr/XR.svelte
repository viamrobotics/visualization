<script lang="ts">
	import { T } from '@threlte/core'
	import { useXR, XR, XRButton } from '@threlte/xr'
	import { World } from '@threlte/rapier'
	import OriginMarker from './OriginMarker.svelte'
	import { useSettings } from '$lib/hooks/useSettings.svelte'
	import Controllers from './Controllers.svelte'
	import CameraFeed from './CameraFeed.svelte'
	import JointLimitsWidget from './JointLimitsWidget.svelte'
	import VRConfigPanel from './VRConfigPanel.svelte'
	import { usePartID } from '$lib/hooks/usePartID.svelte'
	import { useArmClient } from '$lib/hooks/useArmClient.svelte'

	const { ...rest } = $props()

	const { isPresenting } = useXR()
	const settings = useSettings()
	const enableXR = $derived(settings.current.enableXR)

	const partID = usePartID()
	const armClient = useArmClient()

	// Get all enabled camera widgets for the current part
	const enabledCameras = $derived.by(() => {
		const openWidgets = settings.current.openCameraWidgets
		const currentPartID = partID.current
		return openWidgets[currentPartID] || []
	})

	// Get all available arms
	const armNames = $derived(armClient.names)
</script>

{#if enableXR || true}
	<XR>
		<!-- Render all enabled camera feeds with horizontal spacing behind origin -->
		{#each enabledCameras as cameraName, index (cameraName)}
			{@const spacing = 1.2}
			{@const centerOffset = ((enabledCameras.length - 1) * spacing) / 2}
			<CameraFeed
				resourceName={cameraName}
				offset={{ x: index * spacing - centerOffset, y: 1.5, z: -2.5 }}
				scale={0.8}
				enableProfiling={false}
			/>
		{/each}

		<!-- Render joint limits widget for each arm to the right of cameras -->
		{#each armNames as armName, index (armName)}
			{@const spacing = 1.2}
			{@const centerOffset = ((enabledCameras.length - 1) * spacing) / 2}
			{@const widgetX = centerOffset + spacing + 0.3}
			{@const widgetY = 1.5 - index * 0.5}
			<JointLimitsWidget
				{armName}
				offset={{ x: widgetX, y: widgetY, z: -2.5 }}
				scale={0.6}
			/>
		{/each}

		<!-- VR Controller Configuration Panel -->
		<!-- Temporarily disabled due to connection issues -->
		<!-- <VRConfigPanel offset={{ x: 0, y: 2.5, z: -2.5 }} scale={0.7} /> -->

		<World>
			<Controllers />

			<T.Group position.z={-2}>
				<T.Group rotation.x={$isPresenting ? -Math.PI / 2 : 0}>
					<OriginMarker />
				</T.Group>
			</T.Group>
		</World>
	</XR>

	<XRButton
		mode="immersive-ar"
		{...rest}
	/>
{/if}
