<script lang="ts">
	import type { Snippet } from 'svelte'
	import { Canvas } from '@threlte/core'
	import { SvelteQueryDevtools } from '@tanstack/svelte-query-devtools'

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
	import type { Struct } from '@viamrobotics/sdk'
	import { providePartConfig } from '$lib/hooks/usePartConfig.svelte'
	import { useViamClient } from '@viamrobotics/svelte-sdk'
	interface Props {
		partID?: string
		enableKeybindings?: boolean
		children?: Snippet
		getLocalPartConfig?: () => unknown
		setLocalPartConfig?: (config: Struct, partName: string) => void
		getPartName?: () => string | undefined
		isDirty?: () => boolean
	}

	let {
		partID = '',
		enableKeybindings = true,
		children: appChildren,
		getLocalPartConfig,
		setLocalPartConfig,
		getPartName,
		isDirty,
	}: Props = $props()

	const appClient = useViamClient()
	const settings = provideSettings()

	$effect(() => {
		settings.current.enableKeybindings = enableKeybindings
	})

	createPartIDContext(() => partID)

	let root = $state.raw<HTMLElement>()
	let partName = $state<string>()

	$effect.pre(() => {
		async function getPartName() {
			if (appClient?.current === undefined) {
				return
			}
			const partResponse = await appClient.current?.appClient.getRobotPart(partID)
			partName = partResponse?.part?.name ?? ''
		}
		getPartName()
	})

	if (getLocalPartConfig && setLocalPartConfig && getPartName && isDirty) {
		providePartConfig({
			appEmbeddedPartConfigProps: {
				isDirty: () => isDirty(),
				getLocalPartConfig,
				setLocalPartConfig,
				partName: () => getPartName(),
			},
		})
	} else {
		providePartConfig({
			standalonePartConfigProps: {
				viamClient: () => appClient?.current,
				partID,
				partName: () => partName,
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

					{#if !focus}
						<TreeContainer {@attach domPortal(root)} />
					{/if}
				{/snippet}
			</SceneProviders>
		</World>
	</Canvas>
</div>
