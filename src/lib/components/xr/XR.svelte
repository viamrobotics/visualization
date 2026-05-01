<script lang="ts">
	import { useThrelte } from '@threlte/core'
	import { useXR, XR, XRButton } from '@threlte/xr'
	import { SvelteMap } from 'svelte/reactivity'
	import { Quaternion } from 'three'

	import { usePartID } from '$lib/hooks/usePartID.svelte'
	import { useSettings } from '$lib/hooks/useSettings.svelte'

	import CameraFeed from './CameraFeed.svelte'
	import DebugPanel from './DebugPanel.svelte'
	import FrameConfigureControllers from './frame-configure/Controllers.svelte'
	import JointLimitsWidget from './JointLimitsWidget.svelte'
	import OriginMarker from './OriginMarker.svelte'
	import PendingEditsPanel from './PendingEditsPanel.svelte'
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

	// Compose the XR reference space from:
	//   1) a -π/2 rotation around X to switch from WebXR's Y-up to Viam's Z-up
	//   2) the scene origin (position + yaw) so the origin's pose lives at the
	//      composed space's identity. With this, controllers, camera, and scene
	//      content all share one frame — no separate origin group needed.
	let baseRefSpace: XRReferenceSpace | undefined

	$effect(() => {
		if (!$isPresenting) {
			baseRefSpace = undefined
			return
		}

		if (!baseRefSpace) {
			const current = renderer.xr.getReferenceSpace()
			if (!current) return
			baseRefSpace = current
		}

		const [ox, oy, oz] = origin.position
		const oRot = origin.rotation

		const zUpQ = new Quaternion().setFromAxisAngle({ x: 1, y: 0, z: 0 }, -Math.PI / 2)
		const originQ = new Quaternion().setFromAxisAngle({ x: 0, y: 0, z: 1 }, oRot)

		const composed = baseRefSpace
			.getOffsetReferenceSpace(
				new XRRigidTransform(
					{ x: 0, y: 0, z: 0, w: 1 },
					{ x: zUpQ.x, y: zUpQ.y, z: zUpQ.z, w: zUpQ.w }
				)
			)
			.getOffsetReferenceSpace(
				new XRRigidTransform(
					{ x: ox, y: oy, z: oz },
					{ x: originQ.x, y: originQ.y, z: originQ.z, w: originQ.w }
				)
			)

		renderer.xr.setReferenceSpace(composed)
	})
</script>

{#if enableXR}
	<XR
		onsessionend={() => {
			origin.set([0, 0, 0], 0)
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
		<DebugPanel />
		<PendingEditsPanel />

		{#if settings.current.xrMode === 'arm-teleop'}
			<TeleopControllers />
		{:else if settings.current.xrMode === 'frame-configure'}
			<FrameConfigureControllers />
		{/if}

		<OriginMarker />
	</XR>

	<XRButton
		mode="immersive-ar"
		sessionInit={{
			optionalFeatures: [
				'local-floor',
				'bounded-floor',
				'anchors',
				// Required for cross-session persistence — enables
				// `anchor.requestPersistentHandle()` and
				// `session.restorePersistentAnchor()` on Quest Browser.
				'persistent-anchors',
				'plane-detection',
				'layers',
				'hit-test',
			],
		}}
		{...rest}
	/>
{/if}
