<script lang="ts">
	import type { Snippet } from 'svelte'
	import { WebGLRenderer } from 'three'
	import { Canvas } from '@threlte/core'
	import { SvelteQueryDevtools } from '@tanstack/svelte-query-devtools'
	import { provideToast, ToastContainer } from '@viamrobotics/prime-core'
	import type { Struct } from '@viamrobotics/sdk'
	import { useViamClient } from '@viamrobotics/svelte-sdk'
	import Scene from './Scene.svelte'
	import TreeContainer from '$lib/components/Tree/TreeContainer.svelte'
	import Details from '$lib/components/Details.svelte'
	import SceneProviders from './SceneProviders.svelte'
	import XR from '$lib/components/xr/XR.svelte'
	import { createPartIDContext } from '$lib/hooks/usePartID.svelte'
	import Dashboard from './dashboard/Dashboard.svelte'
	import { domPortal } from '$lib/portal'
	import { provideSettings } from '$lib/hooks/useSettings.svelte'
	import FileDrop from './FileDrop.svelte'
	import { provideWeblabs } from '$lib/hooks/useWeblabs.svelte'
	import { providePartConfig } from '$lib/hooks/usePartConfig.svelte'
	import LiveUpdatesBanner from './LiveUpdatesBanner.svelte'
	import ArmPositions from './widgets/ArmPositions.svelte'
	import { provideEnvironment } from '$lib/hooks/useEnvironment.svelte'

	import type { CameraPose } from '$lib/hooks/useControls.svelte'

	interface LocalConfigProps {
		getLocalPartConfig: () => Struct
		setLocalPartConfig: (config: Struct) => void
		isDirty: () => boolean
		getComponentToFragId: () => Record<string, string>
	}

	interface Props {
		partID?: string
		enableKeybindings?: boolean
		children?: Snippet
		localConfigProps?: LocalConfigProps

		/**
		 * Allows setting the initial camera pose
		 */
		cameraPose?: CameraPose
	}

	let {
		partID = '',
		enableKeybindings = true,
		children: appChildren,
		localConfigProps,
		cameraPose,
	}: Props = $props()

	const appClient = useViamClient()
	const settings = provideSettings()
	const environment = provideEnvironment()

	$effect(() => {
		settings.current.enableKeybindings = enableKeybindings
	})

	createPartIDContext(() => partID)

	provideWeblabs()
	provideToast()

	let root = $state.raw<HTMLElement>()

	if (localConfigProps) {
		environment.current.isStandalone = false
		providePartConfig({
			appEmbeddedPartConfigProps: {
				isDirty: () => localConfigProps.isDirty(),
				getLocalPartConfig: () => localConfigProps.getLocalPartConfig(),
				setLocalPartConfig: (config: Struct) => localConfigProps.setLocalPartConfig(config),
				getComponentToFragId: () => localConfigProps.getComponentToFragId(),
			},
		})
	} else {
		environment.current.isStandalone = true
		providePartConfig({
			standalonePartConfigProps: {
				viamClient: () => appClient?.current,
				partID: () => partID,
			},
		})
	}
</script>

{#if settings.current.enableQueryDevtools}
	<SvelteQueryDevtools initialIsOpen />
{/if}

<div
	class="relative h-full w-full overflow-hidden"
	bind:this={root}
>
	<Canvas
		renderMode="on-demand"
		autoRender={false}
		dpr={1.75}
		createRenderer={(canvas) => {
			return new WebGLRenderer({
				canvas,
				powerPreference: 'high-performance',
				antialias: false,
				stencil: false,
				depth: false,
			})
		}}
	>
		<SceneProviders {cameraPose}>
			{#snippet children({ focus })}
				<Scene>
					{@render appChildren?.()}
				</Scene>

				<XR {@attach domPortal(root)} />

				<Dashboard {@attach domPortal(root)} />
				<Details {@attach domPortal(root)} />
				{#if environment.current.isStandalone}
					<LiveUpdatesBanner {@attach domPortal(root)} />
				{/if}

				{#if !focus}
					<TreeContainer {@attach domPortal(root)} />
				{/if}

				{#if !focus && settings.current.enableArmPositionsWidget}
					<ArmPositions {@attach domPortal(root)} />
				{/if}

				<FileDrop {@attach domPortal(root)} />
			{/snippet}
		</SceneProviders>
	</Canvas>

	<ToastContainer />
</div>
