<script lang="ts">
	import type { Snippet } from 'svelte'
	import { Canvas } from '@threlte/core'
	import Scene from './Scene.svelte'
	import TreeContainer from '$lib/components/Tree/TreeContainer.svelte'
	import Details from '$lib/components/Details.svelte'
	import SceneProviders from './SceneProviders.svelte'
	import XR from '$lib/components/xr/XR.svelte'
	import { World } from '@threlte/rapier'
	import { createPartIDContext } from '$lib/hooks/usePartID.svelte'
	import Dashboard from './dashboard/Dashboard.svelte'
	import { domPortal } from '$lib/portal'

	interface Props {
		partID?: string
		children?: Snippet
	}

	let { partID = '', children: appChildren }: Props = $props()

	createPartIDContext(() => partID)

	let root = $state.raw<HTMLElement>()
</script>

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
