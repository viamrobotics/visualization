<script lang="ts">
	import type { Vector2Like } from 'three'
	import { draggable } from '@neodrag/svelte'
	import Tree from './Tree.svelte'
	import { useSelectedEntity } from '$lib/hooks/useSelection.svelte'
	import { provideTreeExpandedContext } from './useExpanded.svelte'
	import Settings from './Settings.svelte'
	import Logs from './Logs.svelte'
	import Widgets from './Widgets.svelte'
	import AddFrames from './AddFrames.svelte'
	import { useEnvironment } from '$lib/hooks/useEnvironment.svelte'
	import { usePartID } from '$lib/hooks/usePartID.svelte'
	import { usePartConfig } from '$lib/hooks/usePartConfig.svelte'
	import { traits, useWorld } from '$lib/ecs'
	import { IsExcluded, type Entity } from 'koota'
	import { buildTreeNodes, type TreeNode } from './buildTree'
	import { useResizable } from '$lib/hooks/useResizable.svelte'
	import { PersistedState } from 'runed'

	const { ...rest } = $props()

	const dragPosition = new PersistedState<Vector2Like | undefined>('tree-drag-position', undefined)

	provideTreeExpandedContext()

	let dragElement = $state.raw<HTMLElement>()

	const partID = usePartID()
	const selectedEntity = useSelectedEntity()
	const environment = useEnvironment()
	const partConfig = usePartConfig()
	const world = useWorld()
	const resizable = useResizable(
		() => 'treeview',
		() => ({ x: 240, y: 320 })
	)

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
	world.onAdd(traits.Parent, flush)
	world.onRemove(traits.Name, flush)
	world.onRemove(traits.Parent, flush)
	world.onChange(traits.Name, flush)
	world.onChange(traits.Parent, flush)

	const rootNode = $derived<TreeNode>({
		entity: worldEntity,
		children,
	})
</script>

<div
	class="bg-extralight border-medium absolute top-0 left-0 z-1000 m-2 resize overflow-y-auto border text-xs"
	style:min-width={resizable.style.minWidth}
	style:min-height={resizable.style.minHeight}
	style:width={resizable.style.width}
	style:height={resizable.style.height}
	use:resizable.resize
	use:draggable={{
		bounds: 'body',
		handle: dragElement,
		defaultPosition: dragPosition.current,
		onDragEnd(data) {
			dragPosition.current = { x: data.offsetX, y: data.offsetY }
		},
	}}
	onresized={resizable.onResized}
	{...rest}
>
	<Tree
		{rootNode}
		bind:dragElement
		selections={selectedEntity.current ? [`${selectedEntity.current}`] : []}
		onSelectionChange={(event) => {
			const value = event.selectedValue[0]

			selectedEntity.set(value ? (Number(value) as Entity) : undefined)
		}}
	/>

	{#if environment.current.isStandalone && partID.current && partConfig.hasEditPermissions}
		<AddFrames />
	{/if}

	<Logs />
	<Settings />
	<Widgets />
</div>
