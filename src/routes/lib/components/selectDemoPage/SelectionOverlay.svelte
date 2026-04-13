<script lang="ts">
	import { useThrelte } from '@threlte/core'
	import { Portal } from '@threlte/extras'
	import { Button } from '@viamrobotics/prime-core'
	import { ElementRect } from 'runed'

	import FloatingPanel from '$lib/components/overlay/FloatingPanel.svelte'
	import { useSelectionPlugin } from '$lib/components/Selection/useSelectionPlugin.svelte'
	import { traits } from '$lib/ecs'

	const { dom } = useThrelte()
	const selectionCtx = useSelectionPlugin()

	const rect = new ElementRect(() => dom)

	$effect(() => {
		const entity = selectionCtx.current.at(-1)
		if (entity) {
			entity.set(traits.Color, { r: 0, g: 1, b: 0 })
		}
	})
</script>

<Portal id="dom">
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
</Portal>
