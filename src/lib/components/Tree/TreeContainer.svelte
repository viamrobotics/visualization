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

	const { ...rest } = $props()

	provideTreeExpandedContext()

	const selected = useSelected()
	const objects = useObjects()
	const draggable = useDraggable('treeview')

	let rootNode = $state<TreeNode>({
		id: 'world',
		name: 'World',
		children: [],
		href: '/',
	})

	const nodes = $derived(buildTreeNodes(objects.current))

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

	<Logs />
	<Settings />
</div>
