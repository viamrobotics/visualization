<script lang="ts">
	import Tree from './Tree.svelte'
	import { buildTreeNodes, type TreeNode } from './buildTree'
	import { useSelectedEntity } from '$lib/hooks/useSelection.svelte'
	import { provideTreeExpandedContext } from './useExpanded.svelte'
	import { isEqual } from 'lodash-es'
	import Settings from './Settings.svelte'
	import Logs from './Logs.svelte'
	import { useDraggable } from '$lib/hooks/useDraggable.svelte'
	import { useWorldStates } from '$lib/hooks/useWorldState.svelte'
	import Widgets from './Widgets.svelte'
	import AddFrames from './AddFrames.svelte'
	import { useEnvironment } from '$lib/hooks/useEnvironment.svelte'
	import { usePartID } from '$lib/hooks/usePartID.svelte'
	import { usePartConfig } from '$lib/hooks/usePartConfig.svelte'
	import WeblabActive from '../weblab/WeblabActive.svelte'
	import { WEBLABS_EXPERIMENTS } from '$lib/hooks/useWeblabs.svelte'
	import { traits, useQuery, useWorld } from '$lib/ecs'
	import { IsExcluded, type Entity } from 'koota'

	const { ...rest } = $props()

	provideTreeExpandedContext()

	const partID = usePartID()
	const selectedEntity = useSelectedEntity()
	const draggable = useDraggable('treeview')
	const worldStates = useWorldStates()
	const environment = useEnvironment()
	const partConfig = usePartConfig()
	const world = useWorld()
	// const entities = useQuery()

	const worldEntity = world.spawn(IsExcluded, traits.Name('World'))

	const rootNode = $state<TreeNode>({
		entity: worldEntity,
		children: [],
	})

	world.onAdd(traits.Name, (entity) => {
		const parent = entity.get(traits.Parent)

		// if (!parent || parent === 'world') {
		// 	rootNode.children?.push({ entity })
		// }
	})

	// const nodes = $derived(buildTreeNodes(entities.current, worldStates.current))

	// $effect.pre(() => {
	// 	if (!isEqual(rootNode.children, nodes)) {
	// 		rootNode.children = nodes
	// 	}
	// })
</script>

<div
	class="bg-extralight border-medium absolute top-0 left-0 z-1000 m-2 w-60 overflow-y-auto border text-xs"
	style:transform="translate({draggable.current.x}px, {draggable.current.y}px)"
	{...rest}
>
	{#key rootNode}
		<Tree
			{rootNode}
			selections={selectedEntity.current ? [`${selectedEntity.current}`] : []}
			onSelectionChange={(event) => {
				const value = event.selectedValue[0]
				selectedEntity.set(value ? (Number(value) as Entity) : undefined)
			}}
			onDragStart={draggable.onDragStart}
			onDragEnd={draggable.onDragEnd}
		/>
	{/key}

	<WeblabActive experiment={WEBLABS_EXPERIMENTS.MOTION_TOOLS_EDIT_FRAME}>
		{#if environment.current.isStandalone && partID.current && partConfig.hasEditPermissions}
			<AddFrames />
		{/if}
	</WeblabActive>

	<Logs />
	<Settings />
	<Widgets />
</div>
