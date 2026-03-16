<script lang="ts">
	import { draggable } from '@neodrag/svelte'
	import { type Entity, IsExcluded } from 'koota'

	import { traits, useQuery, useWorld } from '$lib/ecs'
	import { useEnvironment } from '$lib/hooks/useEnvironment.svelte'
	import { useFrames } from '$lib/hooks/useFrames.svelte'
	import { usePartConfig } from '$lib/hooks/usePartConfig.svelte'
	import { usePartID } from '$lib/hooks/usePartID.svelte'
	import { MIN_DIMENSIONS, useResizable } from '$lib/hooks/useResizable.svelte'
	import { useSelectedEntity } from '$lib/hooks/useSelection.svelte'

	import AddFrames from './AddFrames.svelte'
	import { buildTreeNodes, type TreeNode } from './buildTree'
	import Tree from './Tree.svelte'
	import { provideTreeExpandedContext } from './useExpanded.svelte'

	const { ...rest } = $props()

	provideTreeExpandedContext()

	let container = $state.raw<HTMLDivElement>()
	let dragElement = $state.raw<HTMLElement>()

	const partID = usePartID()
	const selectedEntity = useSelectedEntity()
	const resizable = useResizable(
		() => 'treeview',
		() => ({ width: 240, height: window.innerHeight - 20 })
	)
	const environment = useEnvironment()
	const partConfig = usePartConfig()
	const frames = useFrames()
	const world = useWorld()

	const worldEntity = world.spawn(IsExcluded, traits.Name('World'))

	const allEntities = useQuery(traits.Name)

	const { rootNodes, nodeMap } = $derived.by(() => {
		// This ensures the tree rebuilds when frame parent relationships change
		// eslint-disable-next-line @typescript-eslint/no-unused-expressions
		frames.current
		return buildTreeNodes(allEntities.current)
	})

	const rootNode = $derived<TreeNode>({
		entity: worldEntity,
		children: rootNodes,
	})

	$effect(() => {
		if (container) {
			resizable.observe(container)
		}
	})
</script>

<div
	bind:this={container}
	class="bg-extralight border-medium absolute top-0 left-0 z-4 m-2 resize overflow-y-auto border text-xs"
	style:min-width="{MIN_DIMENSIONS.width}px"
	style:min-height="{MIN_DIMENSIONS.height}px"
	style:width={resizable.current ? `${resizable.current.width}px` : undefined}
	style:height={resizable.current ? `${resizable.current.height}px` : undefined}
	use:draggable={{
		bounds: 'body',
		handle: dragElement,
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
</div>
