<script lang="ts">
	import type { Snippet } from 'svelte'
	import { Canvas } from '@threlte/core'
	import { SvelteQueryDevtools } from '@tanstack/svelte-query-devtools'
	import { provideToast, ToastContainer } from '@viamrobotics/prime-core'
	import type { Struct } from '@viamrobotics/sdk'

	import Scene from './Scene.svelte'
	import TreeContainer from '$lib/components/Tree/TreeContainer.svelte'
	import Details from '$lib/components/Details.svelte'
	import SceneProviders from './SceneProviders.svelte'
	import XR from '$lib/components/xr/XR.svelte'
	import { World } from '@threlte/rapier'
	import { createPartIDContext } from '$lib/hooks/usePartID.svelte'
	import Dashboard from './dashboard/Dashboard.svelte'
	import { domPortal } from '$lib/portal'
	import { provideSettings } from '$lib/hooks/useSettings.svelte'
	import FileDrop from './FileDrop.svelte'
	import WeblabProvider from './weblab/WeblabProvider.svelte'
	import { providePartConfig } from '$lib/hooks/usePartConfig.svelte'
	import { useViamClient } from '@viamrobotics/svelte-sdk'
	import LiveUpdatesBanner from './LiveUpdatesBanner.svelte'

	interface LocalConfigProps {
		getLocalPartConfig: () => unknown
		setLocalPartConfig: (config: Struct, partName: string) => void
		getPartName: () => string | undefined
		isDirty: () => boolean
	}

	interface Props {
		partID?: string
		enableKeybindings?: boolean
		children?: Snippet
		localConfigProps?: LocalConfigProps
	}

	let {
		partID = '',
		enableKeybindings = true,
		children: appChildren,
		localConfigProps,
	}: Props = $props()

	const appClient = useViamClient()
	const settings = provideSettings()

	$effect(() => {
		settings.current.enableKeybindings = enableKeybindings
	})

	createPartIDContext(() => partID)

	provideToast()

	let root = $state.raw<HTMLElement>()
	let isStandalone = $state(false)

	if (localConfigProps) {
		isStandalone = false
		providePartConfig({
			appEmbeddedPartConfigProps: {
				isDirty: () => localConfigProps.isDirty(),
				getLocalPartConfig: () => localConfigProps.getLocalPartConfig(),
				setLocalPartConfig: (config: Struct, partName: string) =>
					localConfigProps.setLocalPartConfig(config, partName),
				partName: () => localConfigProps.getPartName(),
			},
		})
	} else {
		isStandalone = true
		providePartConfig({
			standalonePartConfigProps: {
				viamClient: () => appClient?.current,
				partID,
			},
		})
	}
</script>

{#if settings.current.enableQueryDevtools}
	<SvelteQueryDevtools initialIsOpen />
{/if}

<WeblabProvider>
	<div
		class="relative h-full w-full overflow-hidden"
		bind:this={root}
	>
		<Canvas renderMode="always">
			<World>
				<SceneProviders>
					{#snippet children({ focus })}
						<Scene>
							{@render appChildren?.()}
						</Scene>

						<XR {@attach domPortal(root)} />

						<Dashboard {@attach domPortal(root)} />
						<Details {@attach domPortal(root)} />
						{#if isStandalone}
							<LiveUpdatesBanner {@attach domPortal(root)} />
						{/if}

						{#if !focus}
							<TreeContainer {@attach domPortal(root)} />
						{/if}

						<FileDrop {@attach domPortal(root)} />
					{/snippet}
				</SceneProviders>
			</World>
		</Canvas>

		<ToastContainer />
	</div>
</WeblabProvider>
