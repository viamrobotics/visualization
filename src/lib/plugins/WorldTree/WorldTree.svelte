<script lang="ts">
	import { type Entity, IsExcluded } from 'koota'

	import FloatingPanel from '$lib/components/overlay/FloatingPanel.svelte'
	import { traits, useWorld } from '$lib/ecs'

	import type { TreeNode } from './buildTree'

	import FilterBar from './FilterBar.svelte'
	import PoseStalenessIndicator from './PoseStalenessIndicator.svelte'
	import SceneStalenessIndicator from './SceneStalenessIndicator.svelte'
	import Tree from './Tree.svelte'
	import { useTree } from './useTree.svelte'

	const world = useWorld()

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
	<!--
		The panel header is where the scene admits it is not showing what the user
		expects. Each indicator renders nothing until it has something to say, and
		the tighter gap keeps two of them from crowding out the title.
	-->
	{#snippet headerSuffix()}
		<div class="flex items-center justify-center gap-1.5">
			<SceneStalenessIndicator />

			<!--
				A reconfigure stops the poses too, since `getPose` resolves through
				every input-enabled component. Two badges for one event would fill the
				header with the symptom beside its cause, so the cause is the one that
				shows. Arbitrated here rather than inside the pose indicator, which
				then needs nothing but `usePoses`.
			-->
			{#if sceneStaleness.reason === undefined}
				<PoseStalenessIndicator />
			{/if}
		</div>
	{/snippet}

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
