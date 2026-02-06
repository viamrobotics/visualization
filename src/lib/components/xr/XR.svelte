<script lang="ts">
	import { T } from '@threlte/core'
	import { useXR, XR, XRButton } from '@threlte/xr'
	import { World } from '@threlte/rapier'
	import OriginMarker from './OriginMarker.svelte'
	import { useSettings } from '$lib/hooks/useSettings.svelte'
	import Controllers from './Controllers.svelte'
	import CameraFeed from './CameraFeed.svelte'
	import { usePartID } from '$lib/hooks/usePartID.svelte'

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
			/>
		{/each}

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
