<script lang="ts">
	import { IsExcluded } from 'koota'

	import { traits, useQuery, useWorld } from '$lib/ecs'
	import { useFrames } from '$lib/hooks/useFrames.svelte'
	import { useSelectedEntity } from '$lib/hooks/useSelection.svelte'

	import FloatingPanel from '../FloatingPanel.svelte'
	import { buildTreeNodes, type TreeNode } from './buildTree'
	import Tree from './Tree.svelte'
	import { provideTreeExpandedContext } from './useExpanded.svelte'

	provideTreeExpandedContext()

	const selectedEntity = useSelectedEntity()

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
</script>

<FloatingPanel
	isOpen
	defaultPosition={{ x: 10, y: 10 }}
	defaultSize={{ width: 240, height: 400 }}
	title="World"
	exitable={false}
	resizable
>
	<Tree
		{rootNode}
		{nodeMap}
		onSelectionChange={(event) => {
			const value = event.selectedValue[0]
			const entity = allEntities.current.find((e) => `${e}` === value)
			if (entity?.has(traits.Invisible)) return
			selectedEntity.set(entity)
		}}
	/>
</FloatingPanel>
