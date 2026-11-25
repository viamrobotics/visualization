<!--
@component

Immersive AR: the session and its button, origin calibration, pointer controls, toasts, and the
debug panel. Needs no machine. Machine features go in `children`, which render outside the
session so their settings stay mounted, and read this component's origin context.

```svelte
<XR />

<Machine {partID}>
	<XR anchorKey="xr-origin-anchor:{partID}">
		<XRMachine />
	</XR>
</Machine>
```
-->
<script lang="ts">
	import type { ComponentProps, Snippet } from 'svelte'

	import { useThrelte } from '@threlte/core/webgpu'
	import { useXR, XR, XRButton } from '@threlte/xr'
	import { Quaternion } from 'three'

	import SettingsPortal from '#lib/components/overlay/Portals/SettingsPortal.svelte'
	import { useEnvironment } from '#lib/hooks/useEnvironment.svelte.js'
	import { useSettings } from '#lib/hooks/useSettings.svelte.js'

	import DebugPanel from './DebugPanel.svelte'
	import OriginMarker from './OriginMarker.svelte'
	import { provideAnchors } from './useAnchors.svelte'
	import { provideOrigin } from './useOrigin.svelte'
	import XRPlugins from './XRPlugins.svelte'
	import XRSettings from './XRSettings.svelte'
	import XRToast from './XRToast.svelte'

	/** Spread onto the enter-session button. */
	type ButtonProps = Omit<ComponentProps<typeof XRButton>, 'mode' | 'sessionInit' | 'children'>

	interface Props extends ButtonProps {
		/**
		 * The `localStorage` key the calibrated origin's persistent anchor is saved under. Give
		 * each physical setup its own key, such as one per machine part.
		 */
		anchorKey?: string

		/** XR features that need more context than this component provides, such as `<XRMachine>`. */
		children?: Snippet
	}

	const { anchorKey = 'xr-origin-anchor', children, ...rest }: Props = $props()

	const origin = provideOrigin()
	provideAnchors()

	const { renderer } = useThrelte()
	const { isPresenting } = useXR()
	const settings = useSettings()
	const environment = useEnvironment()

	// Publish the session state so the default camera, the grid and the DOM panels
	// can stand down without every one of them depending on `@threlte/xr`.
	$effect(() => {
		environment.current.isImmersive = $isPresenting

		return () => {
			environment.current.isImmersive = false
		}
	})

	const enableXR = $derived(settings.current.enableXR)

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
			baseRefSpace = renderer.xr.getReferenceSpace() ?? undefined
			if (!baseRefSpace) return
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

{#if $isPresenting}
	<XRPlugins />
{/if}

{#if enableXR}
	<XR
		onsessionend={() => {
			origin.set([0, 0, 0], 0)
		}}
	>
		<XRToast />
		<DebugPanel />
		<OriginMarker {anchorKey} />
	</XR>

	<XRButton
		mode="immersive-ar"
		sessionInit={{
			requiredFeatures: ['webgpu'],
			optionalFeatures: [
				'local-floor',
				'bounded-floor',
				'anchors',
				// Required for cross-session persistence — enables
				// `anchor.requestPersistentHandle()` and
				// `session.restorePersistentAnchor()` on Quest Browser.
				'persistent-anchors',
				'plane-detection',
				'hand-tracking',
				'layers',
				'hit-test',
			],
		}}
		style="color: #555; border-color: #ccc; backdrop-filter: blur(4px); background: rgba(255,255,255,0.5)"
		{...rest}
	/>
{/if}

<SettingsPortal label="AR">
	<XRSettings />
</SettingsPortal>

{@render children?.()}
