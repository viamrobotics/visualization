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
	import { MIN_DIMENSIONS, useResizable } from '$lib/hooks/useResizable.svelte'
	import { PersistedState } from 'runed'

	const { ...rest } = $props()

	const dragPosition = new PersistedState<Vector2Like | undefined>('tree-drag-position', undefined)

	provideTreeExpandedContext()

	let container = $state.raw<HTMLDivElement>()
	let dragElement = $state.raw<HTMLElement>()

	const partID = usePartID()
	const selectedEntity = useSelectedEntity()
	const resizable = useResizable(() => 'treeview')
	const environment = useEnvironment()
	const partConfig = usePartConfig()
	const world = useWorld()

	const worldEntity = world.spawn(IsExcluded, traits.Name('World'))

	let children = $state.raw<TreeNode[]>([])
	let nodeMap = $state.raw<Record<string, TreeNode | undefined>>({})

	let pending = false
	const flush = () => {
		if (pending) return
		pending = true
		return
		window.setTimeout(() => {
			const results = buildTreeNodes(world.query(traits.Name))
			children = results.rootNodes
			nodeMap = results.nodeMap
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

	$effect(() => {
		if (container) {
			resizable.observe(container)
		}
	})
</script>

<div
	bind:this={container}
	class="bg-extralight border-medium absolute top-0 left-0 z-1000 m-2 resize overflow-y-auto border text-xs"
	style:min-width="{MIN_DIMENSIONS.width}px"
	style:min-height="{MIN_DIMENSIONS.height}px"
	style:width={resizable.current ? `${resizable.current.width}px` : undefined}
	style:height={resizable.current ? `${resizable.current.height}px` : undefined}
	use:draggable={{
		bounds: 'body',
		handle: dragElement,
		defaultPosition: dragPosition.current,
		onDragEnd(data) {
			dragPosition.current = { x: Math.max(data.offsetX, 0), y: Math.max(data.offsetY, 0) }
		},
	}}
	{...rest}
>
	<Tree
		{rootNode}
		{nodeMap}
		bind:dragElement
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
