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
	import Widgets from './Widgets.svelte'
	import AddFrames from './AddFrames.svelte'
	import { useEnvironment } from '$lib/hooks/useEnvironment.svelte'
	import { usePartID } from '$lib/hooks/usePartID.svelte'
	import { usePartConfig } from '$lib/hooks/usePartConfig.svelte'
	import { useResizable } from '$lib/hooks/useResizable.svelte'

	const { ...rest } = $props()

	provideTreeExpandedContext()

	const partID = usePartID()
	const selected = useSelected()
	const objects = useObjects()
	const draggable = useDraggable('treeview')
	const resizable = useResizable('treeview')
	const worldStates = useWorldStates()
	const environment = useEnvironment()
	const partConfig = usePartConfig()

	let container = $state<HTMLDivElement>()
	let rootNode = $state<TreeNode>({
		id: 'world',
		name: 'World',
		children: [],
		href: '/',
	})

	const nodes = $derived(buildTreeNodes(objects.current, worldStates.current))

	$effect.pre(() => {
		if (!isEqual(rootNode.children, nodes)) {
			rootNode.children = nodes
		}
	})

	$effect(() => {
		if (container) {
			resizable.observe(container)
		}
	})
</script>

{#if draggable.isLoaded && resizable.isLoaded}
	<div
		bind:this={container}
		class="bg-extralight border-medium absolute top-0 left-0 z-1000 m-2 resize overflow-y-auto border text-xs"
		style:transform="translate({draggable.current.x}px, {draggable.current.y}px)"
		style:width={resizable.current ? `${resizable.current.width}px` : undefined}
		style:height={resizable.current ? `${resizable.current.height}px` : undefined}
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

		{#if environment.current.isStandalone && partID.current && partConfig.hasEditPermissions}
			<AddFrames />
		{/if}

		<Logs />
		<Settings />
		<Widgets />
	</div>
{/if}
