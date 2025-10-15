<script lang="ts">
	import * as tree from '@zag-js/tree-view'
	import { useMachine, normalizeProps } from '@zag-js/svelte'
	import { untrack } from 'svelte'
	import { ChevronRight, Eye, EyeOff } from 'lucide-svelte'
	import { useVisibility } from '$lib/hooks/useVisibility.svelte'
	import type { TreeNode } from './buildTree'
	import { useExpanded } from './useExpanded.svelte'
	import { VirtualList } from 'svelte-virtuallists'
	import { observe } from '@threlte/core'
	import { Icon } from '@viamrobotics/prime-core'

	const visibility = useVisibility()
	const expanded = useExpanded()

	interface Props {
		rootNode: TreeNode
		selections: string[]
		onSelectionChange?: (event: tree.SelectionChangeDetails) => void
		onDragStart?: (event: MouseEvent) => void
		onDragEnd?: (event: MouseEvent) => void
	}

	let { rootNode, selections, onSelectionChange, onDragStart, onDragEnd }: Props = $props()

	const collection = tree.collection<TreeNode>({
		nodeToValue: (node) => node.id,
		nodeToString: (node) => node.name,
		rootNode,
	})

	const service = useMachine(tree.machine, {
		collection,
		onSelectionChange(details) {
			onSelectionChange?.(details)
		},
		onExpandedChange(details) {
			expanded.clear()
			for (const value of details.expandedValue) {
				expanded.add(value)
			}
		},
	})

	const api = $derived(tree.connect(service, normalizeProps))

	observe(
		() => [selections],
		() => untrack(() => api.setSelectedValue(selections))
	)

	observe(
		() => [expanded],
		() => untrack(() => api.setExpandedValue([...expanded]))
	)

	const rootChildren = $derived(collection.rootNode.children ?? [])
</script>

{#snippet treeNode({
	node,
	indexPath,
	api,
}: {
	node: TreeNode
	indexPath: number[]
	api: tree.Api
})}
	{@const nodeProps = { indexPath, node }}
	{@const nodeState = api.getNodeState(nodeProps)}
	{@const isVisible = visibility.get(node.id) ?? true}
	{@const { selected } = nodeState}

	{#if nodeState.isBranch}
		{@const { expanded } = nodeState}
		{@const { children = [] } = node}
		<div
			{...api.getBranchProps(nodeProps)}
			class={{
				'text-disabled': !isVisible,
				'bg-medium': selected,
				sticky: true,
			}}
		>
			<div {...api.getBranchControlProps(nodeProps)}>
				<span
					{...api.getBranchIndicatorProps(nodeProps)}
					class={{ 'rotate-90': expanded }}
				>
					<ChevronRight size={14} />
				</span>
				<span
					class="flex items-center"
					{...api.getBranchTextProps(nodeProps)}
				>
					{node.name}
				</span>

				<button
					class="text-gray-6"
					onclick={(event) => {
						event.stopPropagation()
						visibility.set(node.id, !isVisible)
					}}
				>
					{#if isVisible}
						<Eye size={14} />
					{:else}
						<EyeOff size={14} />
					{/if}
				</button>
			</div>
			<div {...api.getBranchContentProps(nodeProps)}>
				<div {...api.getBranchIndentGuideProps(nodeProps)}></div>

				{#each children as node, index (node.id)}
					{@render treeNode({ node, indexPath: [...indexPath, index], api })}
				{/each}
			</div>
		</div>
	{:else}
		<div
			class={{ 'flex justify-between': true, 'text-disabled': !isVisible, 'bg-medium': selected }}
			{...api.getItemProps(nodeProps)}
		>
			<span class="flex items-center gap-1.5">
				{node.name}
			</span>

			<button
				class="text-gray-6"
				onclick={(event) => {
					event.stopPropagation()
					visibility.set(node.id, !isVisible)
				}}
			>
				{#if isVisible}
					<Eye size={14} />
				{:else}
					<EyeOff size={14} />
				{/if}
			</button>
		</div>
	{/if}
{/snippet}

<div class="root-node">
	<div {...api.getRootProps() as object}>
		<div class="border-medium flex items-center gap-1 border-b p-2">
			<button
				onmousedown={onDragStart}
				onmouseup={onDragEnd}
			>
				<Icon name="drag" />
			</button>
			<h3 {...api.getLabelProps() as object}>{rootNode.name}</h3>
		</div>

		<div
			{...api.getTreeProps()}
			class="w-60"
		>
			{#if rootChildren.length === 0}
				<p class="text-subtle-2 px-2 py-4">No objects displayed</p>
			{:else if rootChildren.length > 200}
				<VirtualList
					class="w-full"
					style="height:{Math.min(8, Math.max(rootChildren.length, 5)) * 32}px;"
					items={rootChildren}
				>
					{#snippet vl_slot({ index, item })}
						{@render treeNode({ node: item, indexPath: [Number(index)], api })}
					{/snippet}
				</VirtualList>
			{:else}
				<div
					style="height:{Math.min(8, Math.max(rootChildren.length, 5)) * 32}px;"
					class="overflow-auto"
				>
					{#each rootChildren as node, index (node.id)}
						{@render treeNode({ node, indexPath: [Number(index)], api })}
					{/each}
				</div>
			{/if}
		</div>
	</div>
</div>

<style>
	:global(:root) {
		[data-scope='tree-view'][data-part='item'],
		[data-scope='tree-view'][data-part='branch-control'] {
			user-select: none;
			--padding-inline: 16px;
			padding-inline-start: calc(var(--depth) * var(--padding-inline));
			padding-inline-end: var(--padding-inline);
			display: flex;
			align-items: center;
			gap: 8px;
			min-height: 32px;
		}

		[data-scope='tree-view'][data-part='item-text'],
		[data-scope='tree-view'][data-part='branch-text'] {
			flex: 1;
		}

		[data-scope='tree-view'][data-part='branch-content'] {
			position: relative;
			isolation: isolate;
		}

		[data-scope='tree-view'][data-part='branch-indent-guide'] {
			position: absolute;
			content: '';
			border-left: 1px solid #eee;
			height: 100%;
			translate: calc(var(--depth) * 1.25rem);
			z-index: 1;
		}
	}
</style>
