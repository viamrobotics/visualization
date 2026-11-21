<script lang="ts">
	import type { Struct } from '@viamrobotics/sdk'
	import type { Entity } from 'koota'
	import type { Snippet } from 'svelte'

	import { PortalTarget } from '@threlte/extras/webgpu'
	import { provideToast, ToastContainer, ToastVariant } from '@viamrobotics/prime-core'
	import { primeTheme } from '@viamrobotics/tweakpane-config'
	import { ThemeUtils } from 'svelte-tweakpane-ui'

	import type { FragmentInfo } from '#lib/hooks/useFragmentInfo.svelte.js'

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
	import { provideFragmentInfo } from '#lib/hooks/useFragmentInfo.svelte.js'
	import { providePartConfig } from '#lib/hooks/usePartConfig.svelte.js'
	import { createPartIDContext } from '#lib/hooks/usePartID.svelte.js'
	import { provideSettings } from '#lib/hooks/useSettings.svelte.js'
	import { provideTransformGizmos } from '#lib/hooks/useTransformGizmos.svelte.js'
	import { provideWeblabs } from '#lib/hooks/useWeblabs.svelte.js'
	import { provideKeybindings } from '#lib/keybindings/index.js'
	import { provideFullscreen } from '#lib/plugins/Fullscreen/useFullscreen.svelte.js'
	import { domPortal } from '#lib/portal.js'

	import { provideSettingsTabs } from './overlay/Portals/useSettingsTabs.svelte'
	import RenderStats from './overlay/widgets/RenderStats.svelte'
	import SceneCanvas from './SceneCanvas.svelte'

	interface LocalConfigProps {
		current: Struct
		isDirty: boolean
		setLocalPartConfig: (config: Struct) => void
	}

	interface Props {
		partID?: string
		inputBindingsEnabled?: boolean
		localConfigProps?: LocalConfigProps

		/**
		 * Maps a component name to the fragment that defines it. Embedded hosts
		 * supply this; in standalone it is computed from fragment queries (omit).
		 */
		componentNameToFragmentInfo?: Record<string, FragmentInfo>

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

	let {
		partID = '',
		inputBindingsEnabled = true,
		localConfigProps,
		componentNameToFragmentInfo,
		cameraPose,
		children: appChildren,
		details,
	}: Props = $props()

	// In setup, not `onMount`: children build their Tweakpane instances during
	// their own setup, so by App's `onMount` the panes already painted dark.
	// Reset first because the theme call removes any variable it already matches,
	// so a repeat call (second instance, remount, HMR) would wipe the theme.
	ThemeUtils.setGlobalDefaultTheme(undefined)
	ThemeUtils.setGlobalDefaultTheme(primeTheme)

	provideWorld()
	provideSettingsTabs()
	provideKeybindings()
	provideTransformGizmos()

	const settings = provideSettings()
	const environment = provideEnvironment()
	const fullscreen = provideFullscreen()

	// After the world and the environment, since the consumers write to them.
	provideDeepLink()
	useDeepLinkMode()
	useDeepLinkSelection()

	provideCameraControls(() => cameraPose)
	createPartIDContext(() => partID)

	provideWeblabs()
	const toast = provideToast()

	let root = $state.raw<HTMLElement>()

	provideFragmentInfo(
		() => partID,
		() => componentNameToFragmentInfo,
		() => localConfigProps?.current
	)

	providePartConfig(
		() => partID,
		() => localConfigProps,
		(message) => toast({ message, variant: ToastVariant.Danger })
	)

	$effect(() => {
		environment.current.inputBindingsEnabled = inputBindingsEnabled
		environment.current.isStandalone = !localConfigProps
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
	<SceneCanvas>
		{@render appChildren?.()}

		{#snippet overlays()}
			<!-- Overlays that need Threlte context -->
			<div {@attach domPortal(root)}>
				<Dashboard />
				<Workspace />
				<Controls />

				<PortalTarget id="dom" />

				{#if settings.current.renderStats && !environment.current.isImmersive}
					<RenderStats />
				{/if}
			</div>
		{/snippet}
	</SceneCanvas>

	<ToastContainer />
</div>
