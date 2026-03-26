<script lang="ts">
	import type { Api } from '@zag-js/tree-view'

	import { ChevronRight, Eye, EyeOff } from 'lucide-svelte'
	import { VirtualList } from 'svelte-virtuallists'

	import { traits, useTrait } from '$lib/ecs'

	import type { TreeNode } from './buildTree'

	import Self from './TreeNode.svelte'

	interface Props {
		node: TreeNode
		indexPath: number[]
		api: Api
	}

	let { node, indexPath, api }: Props = $props()

	const name = useTrait(() => node.entity, traits.Name)
	const invisible = useTrait(() => node.entity, traits.Invisible)

	const nodeProps = $derived({ indexPath, node })
	const nodeState = $derived(api.getNodeState(nodeProps))
</script>

{#if nodeState.isBranch}
	{@const { expanded } = nodeState}
	{@const { children = [] } = node}
	<div
		{...api.getBranchProps(nodeProps)}
		class={[
			'w-full',
			{
				'text-disabled': invisible.current,
				'bg-medium': nodeState.selected,
				sticky: true,
			},
		]}
	>
		<div {...api.getBranchControlProps(nodeProps)}>
			<span
				{...api.getBranchIndicatorProps(nodeProps)}
				class={{ 'rotate-90': expanded }}
			>
				<ChevronRight size={14} />
			</span>
			<span
				class="flex items-center overflow-hidden text-ellipsis"
				{...api.getBranchTextProps(nodeProps)}
			>
				{name.current}
			</span>

			<button
				class="text-gray-6"
				onclick={(event) => {
					event.stopPropagation()

					if (node.entity.has(traits.Invisible)) {
						node.entity.remove(traits.Invisible)
					} else {
						node.entity.add(traits.Invisible)
					}
				}}
			>
				{#if invisible.current}
					<EyeOff size={14} />
				{:else}
					<Eye size={14} />
				{/if}
			</button>
		</div>
		<div {...api.getBranchContentProps(nodeProps)}>
			<div {...api.getBranchIndentGuideProps(nodeProps)}></div>

			{#if children.length > 200}
				<VirtualList
					class="w-full"
					style="height:{Math.min(8, Math.max(children.length, 5)) * 32}px;"
					items={children}
				>
					{#snippet vl_slot({ index, item: node })}
						<Self
							{node}
							indexPath={[...indexPath, Number(index)]}
							{api}
						/>
					{/snippet}
				</VirtualList>
			{:else}
				{#each children as node, index (node.entity)}
					<Self
						{node}
						indexPath={[...indexPath, Number(index)]}
						{api}
					/>
				{/each}
			{/if}
		</div>
	</div>
{:else}
	<div
		class={{
			'flex justify-between': true,
			'text-disabled': invisible.current,
			'bg-medium': nodeState.selected,
		}}
		{...api.getItemProps(nodeProps)}
	>
		<span class="flex items-center gap-1.5 overflow-hidden text-nowrap text-ellipsis">
			{node.entity.get(traits.Name)}
		</span>

		<button
			class="text-gray-6"
			onclick={(event) => {
				event.stopPropagation()
				if (node.entity.has(traits.Invisible)) {
					node.entity.remove(traits.Invisible)
				} else {
					node.entity.add(traits.Invisible)
				}
			}}
		>
			{#if invisible.current}
				<EyeOff size={14} />
			{:else}
				<Eye size={14} />
			{/if}
		</button>
	</div>
{/if}

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
