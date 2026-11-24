<script lang="ts">
	import type { Entity } from 'koota'
	import type { Snippet } from 'svelte'

	import { Canvas } from '@threlte/core/webgpu'
	import { provideToast, Toast } from '@viamrobotics/prime-ui'
	import { NeutralToneMapping } from 'three'
	import { WebGPURenderer } from 'three/webgpu'

	import Controls from '#lib/components/overlay/controls/Controls.svelte'
	import Dashboard from '#lib/components/overlay/dashboard/Dashboard.svelte'
	import Workspace from '#lib/components/overlay/workspace/Workspace.svelte'
	import { provideDeepLink } from '#lib/deepLink/useDeepLink.svelte.js'
	import { useDeepLinkMode } from '#lib/deepLink/useDeepLinkMode.svelte.js'
	import { useDeepLinkSelection } from '#lib/deepLink/useDeepLinkSelection.svelte.js'
	import { provideWorld } from '#lib/ecs/index.js'
	import { type CameraPose, provideCameraControls } from '#lib/hooks/useControls.svelte.js'
	import { provideDetailsSections } from '#lib/hooks/useDetailsSections.svelte.js'
	import { provideEnvironment } from '#lib/hooks/useEnvironment.svelte.js'
	import { provideSettings } from '#lib/hooks/useSettings.svelte.js'
	import { provideTransformGizmos } from '#lib/hooks/useTransformGizmos.svelte.js'
	import { provideWeblabs } from '#lib/hooks/useWeblabs.svelte.js'
	import { provideKeybindings } from '#lib/keybindings/index.js'
	import { provideFullscreen } from '#lib/plugins/Fullscreen/useFullscreen.svelte.js'
	import { domPortal, provideDomPortals } from '#lib/portal.svelte.js'

	import HoveredEntities from './hover/HoveredEntities.svelte'
	import DomPortalTarget from './overlay/Portals/DomPortalTarget.svelte'
	import { provideSettingsTabs } from './overlay/Portals/useSettingsTabs.svelte'
	import Scene from './Scene.svelte'
	import SceneProviders from './SceneProviders.svelte'

	interface Props {
		inputBindingsEnabled?: boolean

		/**
		 * Allows setting the initial camera pose
		 */
		cameraPose?: CameraPose

		/**
		 * Snippet for Three.js objects
		 */
		children?: Snippet

		/**
		 * Snippet to inject items into the details panel. Rendered once with every
		 * selected entity, so it shows or edits the selection as a whole.
		 */
		details?: Snippet<[{ entities: readonly Entity[] }]>
	}

	let { inputBindingsEnabled = true, cameraPose, children: appChildren, details }: Props = $props()

	provideWorld()
	provideDomPortals()
	provideSettingsTabs()
	provideKeybindings()
	provideTransformGizmos()

	provideSettings()
	const environment = provideEnvironment()
	const fullscreen = provideFullscreen()

	// After the world and the environment, since the consumers write to them.
	provideDeepLink()
	useDeepLinkMode()
	useDeepLinkSelection()

	provideCameraControls(() => cameraPose)

	provideWeblabs()
	provideToast()

	let root = $state.raw<HTMLElement>()

	$effect(() => {
		environment.current.inputBindingsEnabled = inputBindingsEnabled
	})

	const detailsSections = provideDetailsSections()

	// The host's `details` snippet is just another section. Registered in an
	// effect so a swapped prop re-registers; sections can't hold an undefined
	// snippet, and no card can render before this first runs.
	$effect(() => {
		if (details === undefined) return
		return detailsSections.register({ snippet: details, label: 'details' })
	})
</script>

<div
	class={[
		'h-full w-full overflow-clip bg-white',
		fullscreen.active ? 'z-max fixed inset-0' : 'relative',
	]}
	bind:this={root}
>
	<Canvas
		renderMode="on-demand"
		toneMapping={NeutralToneMapping}
		createRenderer={(canvas) =>
			new WebGPURenderer({
				canvas,
				antialias: true,
				// Keeps depth precision near-uniform, so nearby surfaces don't z-fight when zoomed out.
				reversedDepthBuffer: true,
			})}
	>
		<SceneProviders>
			<Scene>
				{@render appChildren?.()}
			</Scene>

			<HoveredEntities />

			<!-- Overlays that need Threlte context -->
			<div {@attach domPortal(root)}>
				<Dashboard />
				<Workspace />
				<Controls />

				<DomPortalTarget id="dom" />
			</div>
		</SceneProviders>
	</Canvas>

	<Toast />
</div>
