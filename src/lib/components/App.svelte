<script lang="ts">
	import type { Snippet } from 'svelte'
	import { Canvas } from '@threlte/core'
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
	import { useViamClient } from '@viamrobotics/svelte-sdk'
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

	const appClient = useViamClient()
	const settings = provideSettings()
	const environment = provideEnvironment()

	const currentRobotCameraWidgets = $derived(settings.current.openCameraWidgets[partID] || [])

	$effect(() => {
		settings.current.enableKeybindings = enableKeybindings
	})

	createPartIDContext(() => partID)
	provideDrawConnectionConfig(() => drawConnectionConfig)
	provideWeblabs()
	provideToast()

	let root = $state.raw<HTMLElement>()

	providePartConfig(() => {
		if (localConfigProps) {
			return {
				appEmbeddedPartConfigProps: {
					isDirty: () => localConfigProps.isDirty(),
					getLocalPartConfig: () => localConfigProps.getLocalPartConfig(),
					setLocalPartConfig: (config: Struct) => localConfigProps.setLocalPartConfig(config),
					getComponentToFragId: () => localConfigProps.getComponentToFragId(),
				},
			}
		} else {
			return {
				standalonePartConfigProps: {
					viamClient: () => appClient?.current,
					partID: () => partID,
				},
			}
		}
	})

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

				<Dashboard
					{@attach domPortal(root)}
					{dashboard}
				/>

				{#if settings.current.renderSubEntityHoverDetail}
					<HoveredEntities {@attach domPortal(root)} />
				{/if}
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

				{#if !focus}
					{#each currentRobotCameraWidgets as cameraName (cameraName)}
						<Camera
							name={cameraName}
							{@attach domPortal(root)}
						/>
					{/each}
				{/if}

				<FileDrop {@attach domPortal(root)} />
			{/snippet}
		</SceneProviders>
	</Canvas>

	<ToastContainer />
</div>
