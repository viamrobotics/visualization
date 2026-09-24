<script lang="ts">
	import { normalizeProps, useMachine } from '@zag-js/svelte'
	import * as tree from '@zag-js/tree-view'
	import { VirtualList } from 'svelte-virtuallists'
	import { SvelteSet } from 'svelte/reactivity'

	import { traits, useQuery } from '$lib/ecs'

	import type { TreeNode as TreeNodeType } from './buildTree'

	import { isFolderExpanded, mergeExpandedFolders } from './expandedFolders.svelte'
	import { filterTree } from './filterTree'
	import TreeNode from './TreeNode.svelte'

	interface Props {
		rootNode: TreeNodeType
		/** Child value to parent value, following drawn edges rather than `ChildOf`. */
		parents: Map<string, string>
		/** Name query. Empty shows everything. See `filterTree`. */
		filter?: string
		dragElement?: HTMLElement
		onSelectionChange?: (event: tree.SelectionChangeDetails) => void
	}

	let {
		rootNode,
		parents,
		filter = '',
		onSelectionChange,
		dragElement = $bindable(),
	}: Props = $props()

	const isFiltering = $derived(filter.trim() !== '')

	const selected = useQuery(traits.Selected)

	const selectedValue = $derived(selected.current.map((entity) => `${entity}`))
	const selectedEntities = $derived(new Set(selected.current))

	const collection = $derived(
		tree.collection<TreeNodeType>({
			nodeToValue: (node) => `${node.entity}`,
			nodeToString: (node) => node.entity.get(traits.Name) ?? '',
			rootNode: {
				...rootNode,
				children: filterTree(rootNode.children ?? [], filter, selectedEntities),
			},
		})
	)

	const rootChildren = $derived(collection.rootNode.children ?? [])

	const folderNameOf = (node: TreeNodeType): string | undefined =>
		node.folder ? (node.entity.get(traits.Name) ?? undefined) : undefined

	const expandedValues = new SvelteSet<string>()

	// A filter is useless behind a collapsed folder, so every branch it leaves
	// standing is forced open. Only a collapse the user made against that forced
	// state is remembered, and only for as long as the filter is up.
	const collapsedWhileFiltering = new SvelteSet<string>()

	const expandedValue = $derived(
		isFiltering
			? collection.getBranchValues().filter((value) => !collapsedWhileFiltering.has(value))
			: [...expandedValues]
	)

	$effect(() => {
		if (!isFiltering && collapsedWhileFiltering.size > 0) collapsedWhileFiltering.clear()
	})

	$effect(() => {
		for (const entity of selected.current) {
			let ancestor = parents.get(`${entity}`)
			while (ancestor) {
				expandedValues.add(ancestor)
				ancestor = parents.get(ancestor)
			}
		}
	})

	const id = $props.id()
	const service = useMachine(tree.machine, () => ({
		id,
		collection,
		selectionMode: 'multiple' as const,
		expandOnClick: false,
		selectedValue,
		expandedValue,
		onSelectionChange(details) {
			onSelectionChange?.(details)
		},
		onExpandedChange(details) {
			// The persisted folder state belongs to the unfiltered tree. Writing to it
			// here would store whatever the filter forced open.
			if (isFiltering) {
				const stillExpanded = new Set(details.expandedValue)
				for (const value of collection.getBranchValues()) {
					if (stillExpanded.has(value)) collapsedWhileFiltering.delete(value)
					else collapsedWhileFiltering.add(value)
				}

				return
			}

			expandedValues.clear()
			for (const value of details.expandedValue) {
				expandedValues.add(value)
			}

			// Only folders are recorded. An item's value is its entity id, which is
			// handed out fresh each session and would key nothing on the next load.
			const expandedByName: Record<string, boolean> = {}
			for (const node of rootChildren) {
				const name = folderNameOf(node)
				if (name) expandedByName[name] = expandedValues.has(`${node.entity}`)
			}

			mergeExpandedFolders(expandedByName)
		},
	}))

	const api = $derived(tree.connect(service, normalizeProps))

	const seededFolders = new Set<string>()

	// Seeded once per folder, from what the user left open last session and the
	// folder's own default before that. `.pre` lands the value before the first
	// commit, otherwise every folder renders collapsed for a frame and then pops open.
	$effect.pre(() => {
		for (const node of rootChildren) {
			const name = folderNameOf(node)
			if (name === undefined) continue

			const value = `${node.entity}`
			if (seededFolders.has(value)) continue

			seededFolders.add(value)
			if (isFolderExpanded(name, node.folder?.collapsed ?? false)) {
				expandedValues.add(value)
			}
		}
	})

	let scroller: HTMLElement | undefined = $state()

	$effect(() => {
		const value = selected.current.at(-1)
		if (value === undefined || !scroller) return

		const port = scroller

		const frame = requestAnimationFrame(() => {
			const row = port.querySelector(`[data-scope="tree-view"][data-value="${value}"]`)
			if (!(row instanceof HTMLElement)) return

			// Vertical only. Rows are `w-max min-w-full` and labels `flex: 1 0 auto`, so
			// letting `scrollIntoView` touch the inline axis drags the port back to the
			// name's start on every selection.
			const left = port.scrollLeft
			row.scrollIntoView({ block: 'nearest', inline: 'nearest' })
			port.scrollLeft = left

			// A deeply indented name can still sit past the right edge, so nudge the
			// inline axis by hand, and only when the name is actually out of view.
			const label = row.querySelector('[data-part="item-text"], [data-part="branch-text"]')
			if (!(label instanceof HTMLElement)) return

			const nameLeft = label.getBoundingClientRect().left
			const view = port.getBoundingClientRect()
			if (nameLeft < view.left || nameLeft > view.right) {
				port.scrollLeft += nameLeft - view.left
			}
		})

		return () => cancelAnimationFrame(frame)
	})
</script>

<div
	{...api.getRootProps()}
	bind:this={scroller}
	class="h-full scrollbar-thin overflow-auto text-xs"
>
	<!--
		Sized to the widest row instead of the panel, so deep nesting scrolls
		horizontally rather than wrapping. `min-w-full` keeps rows full width, and
		with them the hover and selection fills, when the tree is shallow.
	-->
	<div
		{...api.getTreeProps()}
		class="w-max min-w-full"
	>
		{#if rootChildren.length === 0}
			<p class="text-subtle-2 px-2 py-4">
				{isFiltering ? 'No matching objects' : 'No objects displayed'}
			</p>
		{:else if rootChildren.length > 200}
			<VirtualList items={rootChildren}>
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

<style>
	/*
	 * svelte-virtuallists stretches its track to its own scroll port, which would
	 * clamp rows back to the panel width. Let it grow with the rows instead, so
	 * names in a virtualized branch scroll horizontally like every other row.
	 * `:global` because the track belongs to VirtualList. The rule lives here
	 * because only this component renders an ancestor it can hang off.
	 */
	[data-part='tree'] :global(.vtlist-inner) {
		width: max-content;
		min-width: 100%;
	}
</style>
