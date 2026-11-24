<!--
@component

The machine half of XR: camera feeds, joint limits, arm teleop, frame configuration, and pending
frame edits, plus their settings. Goes inside both `<Machine>` and `<XR>`.

```svelte
<Machine {partID}>
	<XR anchorKey="xr-origin-anchor:{partID}">
		<XRMachine />
	</XR>
</Machine>
```
-->
<script lang="ts">
	import { useXR } from '@threlte/xr'
	import { SvelteMap } from 'svelte/reactivity'

	import DomPortal from '#lib/components/overlay/Portals/DomPortal.svelte'
	import { useResourceByName } from '#lib/hooks/useResourceByName.svelte.js'
	import { useSettings } from '#lib/hooks/useSettings.svelte.js'

	import CameraFeed from './CameraFeed.svelte'
	import FrameConfigureControllers from './frame-configure/Controllers.svelte'
	import JointLimitsWidget from './JointLimitsWidget.svelte'
	import PendingEditsPanel from './PendingEditsPanel.svelte'
	import TeleopControllers from './teleop/Controllers.svelte'
	import XRMachineSettings from './XRMachineSettings.svelte'
	import { XR_MACHINE_SETTINGS_PORTAL_ID } from './XRSettings.svelte'

	const { isPresenting } = useXR()
	const settings = useSettings()
	const resourceByName = useResourceByName()

	// Cameras chosen for in-headset display in the AR settings panel. Guard against
	// stale names — a selected camera that was removed or is no longer a camera.
	const enabledCameras = $derived.by(() => {
		const names = new Set<string>()
		for (const name of settings.current.xrCameras) {
			if (resourceByName.current[name]?.subtype === 'camera') {
				names.add(name)
			}
		}
		return [...names]
	})

	const cameraAspects = new SvelteMap<string, number>()

	const CAMERA_SCALE = 0.8
	const CAMERA_GAP = 0.15

	// Compute spacing from the widest camera feed (default 16:9 before any aspect is known)
	const maxAspect = $derived(cameraAspects.size > 0 ? Math.max(...cameraAspects.values()) : 16 / 9)
	const feedSpacing = $derived(maxAspect * CAMERA_SCALE + CAMERA_GAP)

	const controllerConfig = $derived(settings.current.xrController)
	const leftArmName = $derived(controllerConfig.left.armName)
	const rightArmName = $derived(controllerConfig.right.armName)
</script>

{#if settings.current.enableXR && $isPresenting}
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

	<PendingEditsPanel />

	{#if settings.current.xrMode === 'arm-teleop'}
		<TeleopControllers />
	{:else if settings.current.xrMode === 'frame-configure'}
		<FrameConfigureControllers />
	{/if}
{/if}

<DomPortal id={XR_MACHINE_SETTINGS_PORTAL_ID}>
	<XRMachineSettings />
</DomPortal>
