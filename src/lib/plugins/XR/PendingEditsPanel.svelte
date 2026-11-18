<script lang="ts">
	import { useWorld } from '$lib/ecs'
	import { resetStagedEdits } from '$lib/editing/resetStagedEdits'
	import { usePartConfig } from '$lib/hooks/usePartConfig.svelte'

	import CanvasPanel from './panels/CanvasPanel.svelte'
	import {
		panelColumn,
		panelIconButton,
		panelLabelButton,
		panelRow,
		panelText,
	} from './panels/panelNode'
	import WristDisplay from './WristDisplay.svelte'

	const partConfig = usePartConfig()
	const world = useWorld()

	const discard = () => {
		partConfig.discardChanges()
		resetStagedEdits(world)
	}

	const root = $derived(
		panelColumn(
			[
				panelText('Pending frame edits', { fontSize: 18 }),
				panelRow(
					[
						panelIconButton('undo-2', () => partConfig.undoFrameEdit(), {
							disabled: !partConfig.canUndoFrameEdit,
						}),
						panelIconButton('redo-2', () => partConfig.redoFrameEdit(), {
							disabled: !partConfig.canRedoFrameEdit,
						}),
						panelLabelButton('Discard', discard),
						panelLabelButton('Save', () => partConfig.save(), { variant: 'primary' }),
					],
					{ gap: 8 }
				),
			],
			{ padding: 16, gap: 12, background: '#111', radius: 16, minWidth: 420 }
		)
	)
</script>

{#if partConfig.isDirty}
	<WristDisplay position={[0, 0.005, 0.1]}>
		<CanvasPanel {root} />
	</WristDisplay>
{/if}
