<script lang="ts">
	import type { Api } from '@zag-js/tree-view'
	import type { Snippet } from 'svelte'

	import { ChevronRight, Eye, EyeOff, Folder, FolderOpen } from 'lucide-svelte'
	import { VirtualList } from 'svelte-virtuallists'

	import EntityLink from '#lib/components/overlay/EntityLink.svelte'
	import { traits, useTrait } from '#lib/ecs/index.js'

	import type { TreeNode } from './buildTree'

	import FolderSettingsButton from './FolderSettingsButton.svelte'
	import IssueRollupIndicator from './IssueRollupIndicator.svelte'
	import IssuesIndicator from './IssuesIndicator.svelte'
	import Self from './TreeNode.svelte'

	interface Props {
		node: TreeNode
		indexPath: number[]
		api: Api
	}

	let { node, indexPath, api }: Props = $props()

	const entityName = useTrait(() => node.entity, traits.Name)
	// Folder entities carry no `Name`, so they stay out of every query over named entities.
	const name = $derived(node.folder?.name ?? entityName.current ?? '')
	const invisible = useTrait(() => node.entity, traits.Invisible)
	const inheritedInvisible = useTrait(() => node.entity, traits.InheritedInvisible)

	// `InheritedInvisible` is what the scene hides by. Without the row's own `Invisible`, a parent set it.
	const isHiddenByParent = $derived(!invisible.current && !!inheritedInvisible.current)
	const visibilityLabel = $derived.by(() => {
		if (isHiddenByParent) return 'Hidden because a parent is hidden'
		return invisible.current ? 'Show' : 'Hide'
	})
	const chunkProgress = useTrait(() => node.entity, traits.ChunkProgress)
	const loading = $derived(chunkProgress.current !== undefined)
	const progress = $derived(
		chunkProgress.current && chunkProgress.current.total > 0
			? chunkProgress.current.loaded / chunkProgress.current.total
			: 0
	)

	const issues = useTrait(() => node.entity, traits.Issues)

	const nodeProps = $derived({ indexPath, node })
	const nodeState = $derived(api.getNodeState(nodeProps))

	// Expanded, the rows underneath carry their own badges, so the hint would only repeat them.
	const rollup = $derived(nodeState.isBranch && !nodeState.expanded ? node.rollup : undefined)
	const hasAlert = $derived(issues.current !== undefined || rollup !== undefined)

	/**
	 * Every row is as wide as the widest row in the tree, so the fill has to be
	 * opaque: the action column is pinned to the viewport and the name scrolls
	 * behind it.
	 */
	const rowClass = $derived([
		nodeState.selected && !node.folder ? 'bg-medium' : 'bg-white hover:bg-light',
		node.folder && 'text-subtle-2 font-medium',
		inheritedInvisible.current && 'text-disabled',
	])

	/**
	 * Folders have nothing to select, so their whole row toggles instead —
	 * overriding the selection `onclick` the machine installs under
	 * `expandOnClick: false`.
	 */
	const branchControlProps = $derived.by(() => {
		const props = api.getBranchControlProps(nodeProps)
		if (!node.folder) return props

		return {
			...props,
			onclick: () => {
				const value = `${node.entity}`
				if (nodeState.expanded) api.collapse([value])
				else api.expand([value])
			},
		}
	})
</script>

{#snippet actionColumn(content: Snippet)}
	<!--
		Sticks to the trailing edge of the scroll port so the row's controls stay
		reachable however deeply the row is indented. `bg-inherit` picks up whichever
		row fill is in play (default, hover, selected) to mask the name behind it.
	-->
	<div class="sticky right-0 flex items-center gap-2 bg-inherit pr-4 pl-2">
		{@render content()}
	</div>
{/snippet}

{#snippet alertIndicators()}
	{#if rollup}
		<IssueRollupIndicator
			label={name}
			{rollup}
		/>
	{/if}

	{#if issues.current}
		<IssuesIndicator
			label={name}
			issues={issues.current}
		/>
	{/if}
{/snippet}

{#snippet folderActions()}
	{@render alertIndicators()}

	{#if node.folder?.hasSettings}
		<FolderSettingsButton
			folderId={node.folder.id}
			label={name}
		/>
	{/if}
{/snippet}

{#snippet itemActions()}
	{@render alertIndicators()}

	{#if loading}
		<span
			role="progressbar"
			aria-label="Loading {Math.round(progress * 100)}%"
			aria-valuenow={Math.round(progress * 100)}
			aria-valuemin={0}
			aria-valuemax={100}
			class="border-gray-6 size-3 rounded-full border"
			style:background="conic-gradient(var(--color-gray-6, #9c9ca4) {progress * 100}%, transparent {progress *
				100}%)"
		></span>
	{/if}

	<button
		type="button"
		class={['text-gray-6', isHiddenByParent && 'opacity-50']}
		aria-label={visibilityLabel}
		title={visibilityLabel}
		onclick={(event) => {
			event.stopPropagation()

			if (node.entity.has(traits.Invisible)) {
				node.entity.remove(traits.Invisible)
			} else {
				node.entity.add(traits.Invisible)
			}
		}}
	>
		{#if invisible.current || isHiddenByParent}
			<EyeOff
				size={14}
				aria-hidden="true"
			/>
		{:else}
			<Eye
				size={14}
				aria-hidden="true"
			/>
		{/if}
	</button>
{/snippet}

{#if nodeState.isBranch}
	{@const { expanded } = nodeState}
	{@const { children = [] } = node}
	<div {...api.getBranchProps(nodeProps)}>
		<div
			{...branchControlProps}
			class={rowClass}
		>
			<button
				type="button"
				aria-label={expanded ? 'Collapse' : 'Expand'}
				{...api.getBranchTriggerProps(nodeProps)}
				class={['flex shrink-0 items-center', { 'rotate-90': expanded && !node.folder }]}
			>
				{#if node.folder}
					{#if expanded}
						<FolderOpen size={14} />
					{:else}
						<Folder size={14} />
					{/if}
				{:else}
					<ChevronRight size={14} />
				{/if}
			</button>
			<span
				class="flex items-center gap-1.5"
				{...api.getBranchTextProps(nodeProps)}
			>
				{name}
				{#if node.folder}
					<span class="text-disabled">
						<span aria-hidden="true">·</span>
						{node.folder.itemCount}
					</span>
				{/if}
				{#if node.detachedParent}
					<span class="text-subtle-2">
						in <EntityLink entity={node.detachedParent} />
					</span>
				{:else if node.missingParent}
					<span class="text-subtle-2">in {node.missingParent}</span>
				{/if}
			</span>

			{#if !node.folder}
				{@render actionColumn(itemActions)}
			{:else if node.folder.hasSettings || hasAlert}
				{@render actionColumn(folderActions)}
			{/if}
		</div>
		<div {...api.getBranchContentProps(nodeProps)}>
			<div {...api.getBranchIndentGuideProps(nodeProps)}></div>

			{#if children.length === 0 && node.folder?.placeholder}
				<p
					class="folder-placeholder text-disabled"
					style:--depth={indexPath.length + 1}
				>
					{node.folder.placeholder}
				</p>
			{:else if children.length > 200}
				<VirtualList
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
		{...api.getItemProps(nodeProps)}
		class={rowClass}
	>
		<span
			class="flex items-center gap-1.5"
			{...api.getItemTextProps(nodeProps)}
		>
			{name}
			{#if node.detachedParent}
				<span class="text-subtle-2">
					in <EntityLink entity={node.detachedParent} />
				</span>
			{:else if node.missingParent}
				<span class="text-subtle-2">in {node.missingParent}</span>
			{/if}
		</span>

		{#if !node.sceneless}
			{@render actionColumn(itemActions)}
		{:else if hasAlert}
			<!-- No visibility toggle here, but a row reporting a problem still says so. -->
			{@render actionColumn(alertIndicators)}
		{/if}
	</div>
{/if}

<style>
	:global(:root) {
		/*
		 * The indent step, declared on every part that reads it — the guides sit in
		 * a sibling subtree, so they can't inherit it from a row.
		 */
		[data-scope='tree-view'][data-part='item'],
		[data-scope='tree-view'][data-part='branch-control'],
		[data-scope='tree-view'][data-part='branch-indent-guide'],
		.folder-placeholder {
			--padding-inline: 16px;
		}

		[data-scope='tree-view'][data-part='item'],
		[data-scope='tree-view'][data-part='branch-control'],
		.folder-placeholder {
			user-select: none;
			padding-inline-start: calc(var(--depth) * var(--padding-inline));
			display: flex;
			align-items: center;
			gap: 8px;
			min-height: 32px;
		}

		/*
		 * Grow so the action column sits at the trailing edge of the row, never
		 * shrink so a long or deeply indented name widens the tree's scroll area
		 * instead of wrapping onto a second line.
		 */
		[data-scope='tree-view'][data-part='item-text'],
		[data-scope='tree-view'][data-part='branch-text'] {
			flex: 1 0 auto;
			white-space: nowrap;
		}

		[data-scope='tree-view'][data-part='branch-content'] {
			position: relative;
			isolation: isolate;
		}

		/*
		 * Centered under the parent's 14px chevron. No z-index: the guides span the
		 * full height of their subtree, so lifting them would draw hairlines across
		 * the pinned action column of every descendant row.
		 */
		[data-scope='tree-view'][data-part='branch-indent-guide'] {
			position: absolute;
			border-left: 1px solid var(--color-gray-3);
			height: 100%;
			translate: calc(var(--depth) * var(--padding-inline) + 7px);
		}
	}
</style>
