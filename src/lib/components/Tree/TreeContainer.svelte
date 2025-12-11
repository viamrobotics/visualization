<script lang="ts">
	import Tree from './Tree.svelte'
	import { useSelectedEntity } from '$lib/hooks/useSelection.svelte'
	import { provideTreeExpandedContext } from './useExpanded.svelte'
	import Settings from './Settings.svelte'
	import Logs from './Logs.svelte'
	import { useDraggable } from '$lib/hooks/useDraggable.svelte'
	import Widgets from './Widgets.svelte'
	import AddFrames from './AddFrames.svelte'
	import { useEnvironment } from '$lib/hooks/useEnvironment.svelte'
	import { usePartID } from '$lib/hooks/usePartID.svelte'
	import { usePartConfig } from '$lib/hooks/usePartConfig.svelte'
	import { traits, useWorld } from '$lib/ecs'
	import { IsExcluded, type Entity } from 'koota'
	import { buildTreeNodes, type TreeNode } from './buildTree'

	const { ...rest } = $props()

	provideTreeExpandedContext()

	const partID = usePartID()
	const selectedEntity = useSelectedEntity()
	const draggable = useDraggable('treeview')
	const environment = useEnvironment()
	const partConfig = usePartConfig()
	const world = useWorld()

	const worldEntity = world.spawn(IsExcluded, traits.Name('World'))

	let children = $state<TreeNode[]>([])

	let pending = false
	const flush = () => {
		if (pending) return
		pending = true
		window.setTimeout(() => {
			children = buildTreeNodes(world.query(traits.Name))
			pending = false
		})
	}

	world.onAdd(traits.Name, flush)
	world.onAdd(traits.EditedParent, flush)
	world.onRemove(traits.Name, flush)
	world.onRemove(traits.EditedParent, flush)
	world.onChange(traits.Name, flush)
	world.onChange(traits.EditedParent, flush)

	const rootNode = $derived<TreeNode>({
		entity: worldEntity,
		children,
	})
</script>

<div
	class="bg-extralight border-medium absolute top-0 left-0 z-1000 m-2 w-60 overflow-y-auto border text-xs"
	style:transform="translate({draggable.current.x}px, {draggable.current.y}px)"
	{...rest}
>
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

	{#if environment.current.isStandalone && partID.current && partConfig.hasEditPermissions}
		<AddFrames />
	{/if}

	<Logs />
	<Settings />
	<Widgets />
</div>
