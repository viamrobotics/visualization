<script lang="ts">
	import * as tree from '@zag-js/tree-view'
	import { useMachine, normalizeProps } from '@zag-js/svelte'
	import { ChevronRight, Eye, EyeOff } from 'lucide-svelte'
	import { useVisibility } from '$lib/hooks/useVisibility.svelte'
	import type { TreeNode } from './buildTree'
	import { VirtualList } from 'svelte-virtuallists'
	import { Icon } from '@viamrobotics/prime-core'
	import { traits } from '$lib/ecs'
	import { useSelectedEntity } from '$lib/hooks/useSelection.svelte'
	import { SvelteSet } from 'svelte/reactivity'

	const selected = useSelectedEntity()
	const visibility = useVisibility()

	interface Props {
		rootNode: TreeNode
		nodeMap: Record<string, TreeNode | undefined>
		dragElement?: HTMLElement
		onSelectionChange?: (event: tree.SelectionChangeDetails) => void
	}

	let { rootNode, nodeMap, onSelectionChange, dragElement = $bindable() }: Props = $props()

	const collection = $derived(
		tree.collection<TreeNode>({
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
	{@const isVisible = visibility.get(node.entity) ?? true}
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
					{node.entity.get(traits.Name)}
				</span>

				<button
					class="text-gray-6"
					onclick={(event) => {
						event.stopPropagation()
						visibility.set(node.entity, !isVisible)
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

				{#each children as node, index (node.entity)}
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
				{node.entity.get(traits.Name)}
			</span>

			<button
				class="text-gray-6"
				onclick={(event) => {
					event.stopPropagation()
					visibility.set(node.entity, !isVisible)
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
			<button bind:this={dragElement}>
				<Icon name="drag" />
			</button>
			<h3 {...api.getLabelProps() as object}>{rootNode.entity.get(traits.Name)}</h3>
		</div>

		<div {...api.getTreeProps()}>
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
					{#each rootChildren as node, index (node.entity)}
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
