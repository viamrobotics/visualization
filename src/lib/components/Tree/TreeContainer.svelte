<script lang="ts">
	import Tree from './Tree.svelte'
	import type { TreeNode } from './buildTree'
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
	import { cacheQuery, IsExcluded, type Entity } from 'koota'

	const { ...rest } = $props()

	provideTreeExpandedContext()

	const partID = usePartID()
	const selectedEntity = useSelectedEntity()
	const draggable = useDraggable('treeview')
	const environment = useEnvironment()
	const partConfig = usePartConfig()
	const world = useWorld()
	// const entities = useQuery(traits.Name)

	const worldEntity = world.spawn(IsExcluded, traits.Name('World'))

	const rootNode = $state<TreeNode>({
		entity: worldEntity,
		children: [],
	})

	const nodeMap: Record<string, TreeNode> = {}
	const looseNodeMap: Record<string, TreeNode[] | undefined> = {}

	const hash = cacheQuery(traits.Name)
	world.onQueryAdd(hash, (entity) => {
		const parent = entity.get(traits.Parent)
		const name = entity.get(traits.Name) ?? ''
		const node: TreeNode = { entity }

		const looseNodes = looseNodeMap[name]
		if (looseNodes) {
			node.children = []
			node.children.push(...looseNodes)
			looseNodeMap[name] = undefined
		}

		nodeMap[name] = node

		if (!parent || parent === 'world') {
			rootNode.children?.push(node)
			return
		}

		const parentNode = nodeMap[parent]

		if (parentNode) {
			parentNode.children ??= []
			parentNode.children.push(node)
		} else {
			looseNodeMap[parent] ??= []
			looseNodeMap[parent].push(node)
		}
	})

	const traverse = (
		children: TreeNode[],
		entity: Entity,
		cb: (children: TreeNode[], index: number) => void
	) => {
		for (let i = 0, l = children.length; i < l; i++) {
			let child = children[i]

			if (entity === child.entity) {
				cb(children, i)

				return
			} else {
				const c = children[i].children

				if (c) traverse(c, entity, cb)
			}
		}
	}

	world.onChange(traits.Name, (entity) => {
		traverse(rootNode.children ?? [], entity, (children, i) => {
			children[i].entity = entity
		})
	})

	world.onQueryRemove(hash, (entity) => {
		traverse(rootNode.children ?? [], entity, (children, i) => {
			children.splice(i, 1)
		})
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

			console.log(value)

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
