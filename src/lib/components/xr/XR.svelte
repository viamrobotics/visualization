<script lang="ts">
	import { T } from '@threlte/core'
	import { useXR, XR, XRButton } from '@threlte/xr'
	import { World } from '@threlte/rapier'
	import OriginMarker from './OriginMarker.svelte'
	import { useSettings } from '$lib/hooks/useSettings.svelte'
	import Controllers from './Controllers.svelte'
	import CameraFeed from './CameraFeed.svelte'
	import JointLimitsWidget from './JointLimitsWidget.svelte'
	import { usePartID } from '$lib/hooks/usePartID.svelte'
	import XRToast from './XRToast.svelte'

	const { ...rest } = $props()

	const { isPresenting } = useXR()
	const settings = useSettings()
	const enableXR = $derived(settings.current.enableXR)

	const partID = usePartID()

	// Get all enabled camera widgets for the current part
	const enabledCameras = $derived.by(() => {
		const openWidgets = settings.current.openCameraWidgets
		const currentPartID = partID.current
		return openWidgets[currentPartID] || []
	})

	// Get arms assigned to controllers
	const controllerConfig = $derived(settings.current.xrControllerConfig)
	const leftArmName = $derived(controllerConfig.left.armName)
	const rightArmName = $derived(controllerConfig.right.armName)
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

		<!-- Render joint limits widgets only for arms assigned to controllers, on the matching side -->
		{#if leftArmName}
			{@const spacing = 1.2}
			{@const centerOffset = ((enabledCameras.length - 1) * spacing) / 2}
			{@const widgetX = -(centerOffset + spacing + 0.3)}
			<JointLimitsWidget
				armName={leftArmName}
				offset={{ x: widgetX, y: 1.5, z: -2.5 }}
				scale={0.6}
				rotationY={15 * (Math.PI / 180)}
			/>
		{/if}
		{#if rightArmName}
			{@const spacing = 1.2}
			{@const centerOffset = ((enabledCameras.length - 1) * spacing) / 2}
			{@const widgetX = centerOffset + spacing + 0.3}
			<JointLimitsWidget
				armName={rightArmName}
				offset={{ x: widgetX, y: 1.5, z: -2.5 }}
				scale={0.6}
			/>
		{/if}

		<!-- XR Controller Configuration Panel -->
		<!-- Temporarily disabled due to connection issues -->
		<!-- <XRConfigPanel offset={{ x: 0, y: 2.5, z: -2.5 }} scale={0.7} /> -->

		<XRToast />

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
