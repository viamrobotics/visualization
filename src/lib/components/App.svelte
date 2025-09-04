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
	import { provideWorldState } from '$lib/hooks/useWorldState.svelte'

	interface Props {
		partID?: string
		enableKeybindings?: boolean
		children?: Snippet
	}

	let { partID = '', enableKeybindings = true, children: appChildren }: Props = $props()

	const settings = provideSettings()
	const worldState = provideWorldState(
		() => partID,
		() => 'world-state'
	)

	$effect(() => {
		settings.current.enableKeybindings = enableKeybindings
	})

	createPartIDContext(() => partID)

	let root = $state.raw<HTMLElement>()

	const logStream = async () => {
		const { data = [] } = worldState.changeStream
		for await (const change of data) {
			const { changeType, transform } = change
			console.log('Log Stream', changeType, transform?.uuid)
		}
	}

	$effect(() => {
		void logStream()
	})
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
