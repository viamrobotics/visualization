<script lang="ts">
	import type { Snippet } from 'svelte'
	import { Canvas } from '@threlte/core'
	import { PortalTarget } from '@threlte/extras'
	import { SvelteQueryDevtools } from '@tanstack/svelte-query-devtools'
	import { provideToast, ToastContainer } from '@viamrobotics/prime-core'
	import type { Struct } from '@viamrobotics/sdk'
	import Scene from './Scene.svelte'
	import TreeContainer from '$lib/components/overlay/left-pane/TreeContainer.svelte'
	import Details from '$lib/components/overlay/Details.svelte'
	import SceneProviders from './SceneProviders.svelte'
	import XR from '$lib/components/xr/XR.svelte'
	import { createPartIDContext } from '$lib/hooks/usePartID.svelte'
	import Dashboard from '$lib/components/overlay/dashboard/Dashboard.svelte'
	import { domPortal } from '$lib/portal'
	import { provideSettings } from '$lib/hooks/useSettings.svelte'
	import FileDrop from './FileDrop/FileDrop.svelte'
	import { provideWeblabs } from '$lib/hooks/useWeblabs.svelte'
	import { providePartConfig } from '$lib/hooks/usePartConfig.svelte'
	import LiveUpdatesBanner from './overlay/LiveUpdatesBanner.svelte'
	import ArmPositions from './overlay/widgets/ArmPositions.svelte'
	import { provideEnvironment } from '$lib/hooks/useEnvironment.svelte'
	import type { CameraPose } from '$lib/hooks/useControls.svelte'
	import { provideWorld } from '$lib/ecs'
	import {
		provideDrawConnectionConfig,
		type DrawConnectionConfig,
	} from '$lib/hooks/useDrawConnectionConfig.svelte'
	import Camera from './overlay/widgets/Camera.svelte'
	import HoveredEntities from './hover/HoveredEntities.svelte'
	import Settings from '$lib/components/overlay/settings/Settings.svelte'
	import { useXR } from '@threlte/xr'

	interface LocalConfigProps {
		current: Struct
		isDirty: boolean
		componentToFragId: Record<string, string>
		setLocalPartConfig: (config: Struct) => void
	}

	interface Props {
		partID?: string
		enableKeybindings?: boolean
		children?: Snippet
		dashboard?: Snippet
		localConfigProps?: LocalConfigProps
		drawConnectionConfig?: DrawConnectionConfig

		/**
		 * Allows setting the initial camera pose
		 */
		cameraPose?: CameraPose
	}

	let {
		partID = '',
		enableKeybindings = true,
		localConfigProps,
		cameraPose,
		drawConnectionConfig,
		children: appChildren,
		dashboard,
	}: Props = $props()

	provideWorld()

	const settings = provideSettings()
	const environment = provideEnvironment()
	const currentRobotCameraWidgets = $derived(settings.current.openCameraWidgets[partID] || [])
	const { isPresenting } = useXR()

	$effect(() => {
		settings.current.enableKeybindings = enableKeybindings
	})

	createPartIDContext(() => partID)
	provideDrawConnectionConfig(() => drawConnectionConfig)
	provideWeblabs()
	provideToast()

	let root = $state.raw<HTMLElement>()

	providePartConfig(
		() => partID,
		() => localConfigProps
	)

	$effect.pre(() => {
		if (localConfigProps) {
			environment.current.isStandalone = false
		} else {
			environment.current.isStandalone = true
		}
	})
</script>

{#if settings.current.enableQueryDevtools}
	<SvelteQueryDevtools initialIsOpen />
{/if}

<div
	class="relative h-full w-full overflow-hidden"
	bind:this={root}
>
	<Canvas renderMode="on-demand">
		<SceneProviders {cameraPose}>
			{#snippet children({ focus })}
				<Scene>
					{@render appChildren?.()}
				</Scene>

				<XR {@attach domPortal(root)} />

				{#if settings.current.renderSubEntityHoverDetail}
					<HoveredEntities />
				{/if}

				<!-- Overlays that need Threlte context -->
				<div {@attach domPortal(root)}>
					<FileDrop />
					<Dashboard {dashboard} />
					<Details />
					<Settings />

					{#if environment.current.isStandalone}
						<LiveUpdatesBanner />
					{/if}

					{#if !focus}
						<TreeContainer />
					{/if}

					{#if !focus && settings.current.enableArmPositionsWidget}
						<ArmPositions />
					{/if}

					{#if !focus && !$isPresenting}
						{#each currentRobotCameraWidgets as cameraName (cameraName)}
							<Camera name={cameraName} />
						{/each}
					{/if}

					<PortalTarget id="dom" />
				</div>
			{/snippet}
		</SceneProviders>
	</Canvas>

	<ToastContainer />
</div>
