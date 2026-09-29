<script lang="ts">
	import { type Entity, IsExcluded } from 'koota'

	import FloatingPanel from '$lib/components/overlay/FloatingPanel.svelte'
	import { traits, useWorld } from '$lib/ecs'
	import { poseStalenessSummary } from '$lib/hooks/poseStaleness/poseStalenessSummary'
	import { useResourceHealth } from '$lib/hooks/resources/useResourceHealth.svelte'
	import { usePoses } from '$lib/hooks/usePoses.svelte'

	import type { TreeNode } from './buildTree'

	import AddObjectMenu from './AddObjectMenu.svelte'
	import FilterBar from './FilterBar.svelte'
	import Tree from './Tree.svelte'
	import { useTree } from './useTree.svelte'

	const world = useWorld()

	const health = useResourceHealth()
	const poses = usePoses()
	const stalenessAnnouncement = $derived(
		poses.isStale ? poseStalenessSummary(health.unhealthy) : ''
	)

	const worldEntity = world.spawn(IsExcluded, traits.Name('World'))

	const tree = useTree()

	const rootNode = $derived<TreeNode>({
		entity: worldEntity,
		children: tree.current,
	})

	let filter = $state('')
</script>

<FloatingPanel
	isOpen
	defaultPosition={{ x: 10, y: 48 }}
	defaultSize={{ width: 240, height: 400 }}
	title="World"
	exitable={false}
	resizable
	bodyClass="flex flex-col bg-white"
>
	{#snippet headerSuffix()}
		<AddObjectMenu />
	{/snippet}

	<!--
		The warning is announced from the panel rather than from the Frames row that
		carries the icon: that row can be collapsed or scrolled out of the virtual
		list, and a live region only announces while it is mounted.
	-->
	<div
		role="status"
		class="sr-only"
	>
		{stalenessAnnouncement}
	</div>

	<FilterBar bind:value={filter} />

	<!-- The tree owns the scroll port, so it needs a fixed track to scroll inside. -->
	<div class="min-h-0 flex-1">
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
					// Folder rows and the `World` root are `IsExcluded`, so they never come
					// back out of the `Selected` query — selecting one would clear the
					// user's real selection on the next round trip.
					if (entity.has(IsExcluded)) continue
					if (!entity.has(traits.Selected)) entity.add(traits.Selected)
				}
			}}
		/>
	</div>
</FloatingPanel>
