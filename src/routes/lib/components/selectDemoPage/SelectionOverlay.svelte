<script lang="ts">
	import { useThrelte } from '@threlte/core'
	import { Button } from '@viamrobotics/prime-core'
	import { ElementRect } from 'runed'

	import { FloatingPanel } from '#lib'
	import { traits } from '#lib/ecs/index.js'
	import { useWorld } from '#lib/ecs/index.js'
	import { useSelectionPlugin } from '#lib/plugins/index.js'
	import { PointsCapturedBy, SelectedFrom } from '#lib/plugins/Selection/relations.js'

	const { dom } = useThrelte()
	const world = useWorld()
	const selectionCtx = useSelectionPlugin()
	const rect = new ElementRect(() => dom)

	$effect(() => {
		const entity = selectionCtx.current.at(-1)
		if (entity) {
			entity.set(traits.Color, { r: 0, g: 1, b: 0 })
			const selectInstance = entity.targetFor(PointsCapturedBy)
			if (!selectInstance) return
			const selectionEntities = world.query(PointsCapturedBy(selectInstance))
			for (const selectionEntity of selectionEntities) {
				const name = selectionEntity.get(traits.Name)
				const sourceEntity = selectionEntity.targetFor(SelectedFrom)
				const selectedFrom = sourceEntity?.get(traits.Name)
				selectionEntity.set(traits.Name, `${name} (selected from ${selectedFrom})`)
			}
		}
	})
</script>

<FloatingPanel
	isOpen
	exitable={false}
	title="Lasso"
	defaultSize={{ width: 445, height: 100 }}
	defaultPosition={{ x: rect.width / 2 - 200, y: rect.height - 10 - 100 }}
>
	<div class="flex items-center gap-4 p-4 text-xs">
		Shift + click and drag to make a lasso selection.
		<Button
			variant="success"
			onclick={() => console.log(selectionCtx.current)}
		>
			Commit selection
		</Button>
		<Button
			variant="danger"
			onclick={() => selectionCtx.clearSelections()}
		>
			Clear selection
		</Button>
	</div>
</FloatingPanel>
