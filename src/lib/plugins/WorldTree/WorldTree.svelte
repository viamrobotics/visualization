<script lang="ts">
	import { PortalTarget } from '@threlte/extras/webgpu'
	import { type Entity, IsExcluded } from 'koota'

	import FloatingPanel from '#lib/components/overlay/FloatingPanel.svelte'
	import { setIssues, traits, useFolder, useWorld } from '#lib/ecs/index.js'
	import { useEnvironment } from '#lib/hooks/useEnvironment.svelte.js'

	import type { TreeNode } from './buildTree'

	import FilterBar from './FilterBar.svelte'
	import Tree from './Tree.svelte'
	import { useTree } from './useTree.svelte'

	const world = useWorld()
	const environment = useEnvironment()

	const worldEntity = world.spawn(IsExcluded, traits.Name('World'))

	// Claimed by rule in `buildTree`, not by source, so neither lists any.
	const missingParent = useFolder({
		id: 'missing-parent',
		name: 'Missing parent',
		order: Infinity,
		sources: [],
		collapsed: true,
	})
	const other = useFolder({ id: 'other', name: 'Other', order: Infinity, sources: [] })

	// The folder is only in the tree while it holds an orphan, so its warning can stand unconditionally.
	setIssues(missingParent, 'missing-parent', [
		{
			severity: 'warn',
			message:
				'The parent frames these objects name are not found, so they are positioned relative to the world origin.',
		},
	])

	const tree = useTree({ missingParent, other })

	/** Issues on the folders in view, read out as they change, since a folder badge is easy to miss. */
	const folderAnnouncement = $derived(
		tree.current
			.flatMap((node) => [...(node.entity.get(traits.Issues)?.values() ?? [])].flat())
			.map((line) => line.message)
			.join('. ')
	)

	const rootNode = $derived<TreeNode>({
		entity: worldEntity,
		children: tree.current,
	})

	let filter = $state('')
</script>

<FloatingPanel
	isOpen
	defaultPosition={{ x: 10, y: 10 }}
	defaultSize={{ width: 240, height: 400 }}
	title="World"
	exitable={false}
	resizable
	bodyClass="flex flex-col bg-white"
>
	{#snippet headerSuffix()}
		<!-- Plugins that add objects to the scene portal their menus in here. -->
		<PortalTarget id="world-tree-actions" />
	{/snippet}

	<div
		role="status"
		class="sr-only"
	>
		{folderAnnouncement}
	</div>

	<!-- Nothing to filter in an empty scene. Kept while a query is typed, so it can be cleared. -->
	{#if tree.current.length > 0 || filter !== ''}
		<FilterBar bind:value={filter} />
	{/if}

	<!-- The tree owns the scroll port, so it needs a fixed track to scroll inside. -->
	<div class="min-h-0 flex-1">
		{#if !environment.current.isImmersive}
			<Tree
				{rootNode}
				{filter}
				parents={tree.parents}
				onSelectionChange={(event) => {
					const next = new Set(event.selectedValue.map(Number))

					for (const entity of world.query(traits.Selected)) {
						if (!next.has(entity as number)) entity.remove(traits.Selected)
					}

					for (const id of next) {
						const entity = id as Entity
						// Folder rows have nothing to select, and the `World` root is `IsExcluded`,
						// so it never comes back out of the `Selected` query.
						if (entity.has(IsExcluded) || entity.has(traits.Folder)) continue
						if (!entity.has(traits.Selected)) entity.add(traits.Selected)
					}
				}}
			/>
		{/if}
	</div>
</FloatingPanel>
