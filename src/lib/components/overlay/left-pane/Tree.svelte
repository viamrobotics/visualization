<script lang="ts">
	import { normalizeProps, useMachine } from '@zag-js/svelte'
	import * as tree from '@zag-js/tree-view'
	import { VirtualList } from 'svelte-virtuallists'
	import { SvelteSet } from 'svelte/reactivity'

	import { traits } from '$lib/ecs'
	import { useSelectedEntity } from '$lib/hooks/useSelection.svelte'

	import type { TreeNode as TreeNodeType } from './buildTree'

	import TreeNode from './TreeNode.svelte'

	const selected = useSelectedEntity()

	interface Props {
		rootNode: TreeNodeType
		nodeMap: Record<string, TreeNodeType | undefined>
		dragElement?: HTMLElement
		onSelectionChange?: (event: tree.SelectionChangeDetails) => void
	}

	let { rootNode, nodeMap, onSelectionChange, dragElement = $bindable() }: Props = $props()

	const collection = $derived(
		tree.collection<TreeNodeType>({
			nodeToValue: (node) => `${node.entity}`,
			nodeToString: (node) => node.entity.get(traits.Name) ?? '',
			rootNode,
		})
	)

	const selectedValue = $derived(selected.current ? [`${selected.current}`] : [])
	const expandedValues = new SvelteSet<string>()

	$effect(() => {
		let name = selected.current?.get(traits.Name)
		let node = nodeMap[name ?? '']
		while (node) {
			expandedValues.add(`${node.entity}`)
			node = node.parent
		}
	})

	const id = $props.id()
	const service = useMachine(tree.machine, () => ({
		id,
		collection,
		selectedValue,
		expandedValue: [...expandedValues],
		onSelectionChange(details) {
			onSelectionChange?.(details)
		},
		onExpandedChange(details) {
			expandedValues.clear()
			for (const value of details.expandedValue) {
				expandedValues.add(value)
			}
		},
	}))

	const api = $derived(tree.connect(service, normalizeProps))
	const rootChildren = $derived(collection.rootNode.children ?? [])

	$effect(() => {
		const element = document.querySelector(
			`[data-scope="tree-view"][data-value="${selected.current}"]`
		)

		requestAnimationFrame(() => {
			element?.scrollIntoView({ block: 'nearest' })
		})
	})
</script>

<div
	{...api.getRootProps()}
	class="h-full overflow-auto text-xs"
>
	<div {...api.getTreeProps()}>
		{#if rootChildren.length === 0}
			<p class="text-subtle-2 px-2 py-4">No objects displayed</p>
		{:else if rootChildren.length > 200}
			<VirtualList
				class="w-full"
				items={rootChildren}
			>
				{#snippet vl_slot({ index, item: node })}
					<TreeNode
						{node}
						indexPath={[Number(index)]}
						{api}
					/>
				{/snippet}
			</VirtualList>
		{:else}
			{#each rootChildren as node, index (node.entity)}
				<TreeNode
					{node}
					indexPath={[Number(index)]}
					{api}
				/>
			{/each}
		{/if}
	</div>
</div>
