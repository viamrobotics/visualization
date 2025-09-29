<script lang="ts">
	import Tree from './Tree.svelte'

	import { buildTreeNodes, type TreeNode } from './buildTree'
	import { useSelected } from '$lib/hooks/useSelection.svelte'
	import { provideTreeExpandedContext } from './useExpanded.svelte'
	import { isEqual } from 'lodash-es'
	import { useObjects } from '$lib/hooks/useObjects.svelte'
	import Settings from './Settings.svelte'
	import Logs from './Logs.svelte'
	import { useDraggable } from '$lib/hooks/useDraggable.svelte'
	import { useWorldStates } from '$lib/hooks/useWorldState.svelte'
	import { useFrames } from '$lib/hooks/useFrames.svelte'
	import { usePartID } from '$lib/hooks/usePartID.svelte'
	import { useSettings } from '$lib/hooks/useSettings.svelte'
	const { ...rest } = $props()

	provideTreeExpandedContext()

	const selected = useSelected()
	const objects = useObjects()
	const draggable = useDraggable('treeview')
	const worldStates = useWorldStates()
	const settings = useSettings()
	const frames = useFrames()
	const partID = usePartID()

	let rootNode = $state<TreeNode>({
		id: 'world',
		name: 'World',
		children: [],
		href: '/',
	})

	const nodes = $derived(buildTreeNodes(objects.current, worldStates.current))

	// MATTHEW: this is a hack to get the no frame nodes, ideally the useAppQuery would work to get the config but is not functioning properly
	let noFrameNodes = $state<{ name: string }[]>([])
	$effect.pre(() => {
		async function getNoFrameNodes() {
			noFrameNodes = await frames.getRobotComponentsWithNoFrame(partID.current)
		}
		getNoFrameNodes()
	})

	const addFrame = (componentName: string) => {
		frames.createFrame(partID.current, componentName)
	}

	$effect.pre(() => {
		if (!isEqual(rootNode.children, nodes)) {
			rootNode.children = nodes
		}
	})
</script>

<div
	class="bg-extralight border-medium absolute top-0 left-0 z-1000 m-2 overflow-y-auto border text-xs"
	style:transform="translate({draggable.current.x}px, {draggable.current.y}px)"
	{...rest}
>
	{#key rootNode}
		<Tree
			{rootNode}
			selections={selected.current ? [selected.current] : []}
			onSelectionChange={(event) => {
				selected.set(event.selectedValue[0])
			}}
			onDragStart={draggable.onDragStart}
			onDragEnd={draggable.onDragEnd}
		/>
	{/key}

	{#if settings.current.viewerMode === 'edit'}
		<div class="border-medium border-t p-2">
			<h3 class="mb-2 font-semibold">Components Without Frames</h3>
			{#await noFrameNodes}
				<div class="text-gray-500">Loading...</div>
			{:then components}
				{#if components && components.length > 0}
					<ul class="space-y-1">
						{#each components as component (component.name)}
							<li class="text-sm text-gray-700">
								{component.name}
								<button
									class="focus:ring-opacity-50 ml-2 rounded bg-blue-500 px-2 py-1 text-xs text-white hover:bg-blue-600 focus:ring-2 focus:ring-blue-500 focus:outline-none"
									onclick={() => addFrame(component.name)}>Add Frame</button
								>
							</li>
						{/each}
					</ul>
				{:else}
					<div class="text-sm text-gray-500">No components without frames</div>
				{/if}
			{:catch error}
				<div class="text-sm text-red-500">Error loading components: {error.message}</div>
			{/await}
		</div>
	{/if}

	<Logs />
	<Settings />
</div>
