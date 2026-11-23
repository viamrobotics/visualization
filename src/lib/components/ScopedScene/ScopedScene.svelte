<!--
@component

The shared scene for one machine part, with no overlays and no page-level state. It owns the canvas and
the contexts the scene reads, and takes everything else from its props and the Viam provider, so a host
can mount it in any DOM subtree.

It must render under a `ViamProvider` from `@viamrobotics/svelte-sdk`. That requirement is temporary,
and mounting with no provider is planned.
-->
<script lang="ts">
	import SceneCanvas from '#lib/components/SceneCanvas.svelte'
	import { provideWorld } from '#lib/ecs/index.js'
	import { provideCameraControls } from '#lib/hooks/useControls.svelte.js'
	import { provideEnvironment } from '#lib/hooks/useEnvironment.svelte.js'
	import { provideFragmentInfo } from '#lib/hooks/useFragmentInfo.svelte.js'
	import { providePartConfig } from '#lib/hooks/usePartConfig.svelte.js'
	import { createPartIDContext } from '#lib/hooks/usePartID.svelte.js'
	import { provideSettings } from '#lib/hooks/useSettings.svelte.js'
	import { provideKeybindings } from '#lib/keybindings/index.js'

	import type { ScopedSceneProps } from './ScopedSceneProps'

	const DEFAULT_POSE_REFRESH_RATE_MS = 1000

	let {
		partID = '',
		cameraPose,
		inputBindingsEnabled = false,
		children,
		snapping = false,
		poseRefreshRate = DEFAULT_POSE_REFRESH_RATE_MS,
		onError,
	}: ScopedSceneProps = $props()

	provideWorld()
	provideKeybindings()

	const settings = provideSettings({ persist: false })
	const environment = provideEnvironment()

	// Run once in setup, so the first key press already sees the host's choice, then on every change.
	const syncEnvironment = () => {
		environment.current.inputBindingsEnabled = inputBindingsEnabled
	}
	syncEnvironment()
	$effect.pre(syncEnvironment)

	const syncSettings = () => {
		settings.current.snapping = snapping
		settings.current.refreshRates.poses = poseRefreshRate
	}
	syncSettings()
	$effect.pre(syncSettings)

	provideCameraControls(() => cameraPose)
	createPartIDContext(() => partID)

	provideFragmentInfo(
		() => partID,
		() => undefined,
		() => undefined
	)

	providePartConfig(
		() => partID,
		() => undefined,
		(message) => onError?.(message)
	)
</script>

<div class="scoped-scene">
	<SceneCanvas>
		{@render children?.()}
	</SceneCanvas>
</div>

<style>
	/* Plain CSS, not Tailwind utilities, so the scene fills its box in a host that loads no Tailwind build. */
	.scoped-scene {
		position: relative;
		width: 100%;
		height: 100%;
		overflow: clip;
	}
</style>
