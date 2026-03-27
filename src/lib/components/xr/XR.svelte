<script lang="ts">
	import { useThrelte } from '@threlte/core'
	import { useXR, XR, XRButton } from '@threlte/xr'
	import { SvelteMap } from 'svelte/reactivity'
	import { Quaternion } from 'three'

	import { usePartID } from '$lib/hooks/usePartID.svelte'
	import { useSettings } from '$lib/hooks/useSettings.svelte'

	import CameraFeed from './CameraFeed.svelte'
	import FrameConfigureControllers from './frame-configure/Controllers.svelte'
	import JointLimitsWidget from './JointLimitsWidget.svelte'
	import OriginMarker from './OriginMarker.svelte'
	import TeleopControllers from './teleop/Controllers.svelte'
	import { provideAnchors } from './useAnchors.svelte'
	import { useOrigin } from './useOrigin.svelte'
	import XRToast from './XRToast.svelte'

	const { ...rest } = $props()

	const { isPresenting } = useXR()
	const settings = useSettings()
	const origin = useOrigin()
	provideAnchors()
	const enableXR = $derived(settings.current.enableXR)

	const partID = usePartID()

	// Get all enabled camera widgets for the current part
	const enabledCameras = $derived.by(() => {
		const openWidgets = settings.current.openCameraWidgets
		const currentPartID = partID.current
		return openWidgets[currentPartID] || []
	})

	// Track camera aspect ratios to compute proper spacing
	const cameraAspects = new SvelteMap<string, number>()

	const CAMERA_SCALE = 0.8
	const CAMERA_GAP = 0.15 // gap between feed edges

	// Compute spacing from the widest camera feed (default 16:9 before any aspect is known)
	const maxAspect = $derived(cameraAspects.size > 0 ? Math.max(...cameraAspects.values()) : 16 / 9)
	const feedSpacing = $derived(maxAspect * CAMERA_SCALE + CAMERA_GAP)

	// Get arms assigned to controllers
	const controllerConfig = $derived(settings.current.xrController)
	const leftArmName = $derived(controllerConfig.left.armName)
	const rightArmName = $derived(controllerConfig.right.armName)

	const { renderer } = useThrelte()

	// Move into Viam's coordinate system. This basically accomplishes
	// the same thing as setting z up in the Camera component.
	$effect(() => {
		if ($isPresenting) {
			const q = new Quaternion().setFromAxisAngle({ x: 1, y: 0, z: 0 }, -Math.PI / 2)

			// after the XR session has started and a reference space exists:
			const baseRefSpace = renderer.xr.getReferenceSpace()
			if (baseRefSpace) {
				const rotatedRefSpace = baseRefSpace.getOffsetReferenceSpace(
					new XRRigidTransform({ x: 0, y: 0, z: 0, w: 1 }, { x: q.x, y: q.y, z: q.z, w: q.w })
				)

				renderer.xr.setReferenceSpace(rotatedRefSpace)
			}
		}
	})
</script>

{#if enableXR}
	<XR
		onsessionstart={() => {
			origin.set([0, 0, -2])
		}}
		onsessionend={() => {
			origin.set([0, 0, 0])
		}}
	>
		<!-- Render camera feeds only when presenting to avoid conflicting with overlay Camera widgets -->
		{#if $isPresenting}
			{#each enabledCameras as cameraName, index (cameraName)}
				{@const centerOffset = ((enabledCameras.length - 1) * feedSpacing) / 2}
				<CameraFeed
					resourceName={cameraName}
					offset={{ x: index * feedSpacing - centerOffset, y: 1.5, z: -2.5 }}
					scale={CAMERA_SCALE}
					enableProfiling={false}
					onAspectChange={(a) => {
						cameraAspects.set(cameraName, a)
					}}
				/>
			{/each}
		{/if}

		<!-- Render joint limits widgets only for arms assigned to controllers, on the matching side -->
		{#if leftArmName}
			<JointLimitsWidget
				armName={leftArmName}
				offset={{ x: -0.5, y: 2.5, z: -2.5 }}
				scale={0.6}
			/>
		{/if}
		{#if rightArmName}
			<JointLimitsWidget
				armName={rightArmName}
				offset={{ x: 0.5, y: 2.5, z: -2.5 }}
				scale={0.6}
			/>
		{/if}

		<!-- XR Controller Configuration Panel -->
		<!-- Temporarily disabled due to connection issues -->
		<!-- <XRConfigPanel offset={{ x: 0, y: 2.5, z: -2.5 }} scale={0.7} /> -->

		<XRToast />

		{#if settings.current.xrMode === 'arm-teleop'}
			<TeleopControllers />
		{:else if settings.current.xrMode === 'frame-configure'}
			<FrameConfigureControllers />
		{/if}

		<OriginMarker />
	</XR>

	<XRButton
		mode="immersive-ar"
		{...rest}
	/>
{/if}
