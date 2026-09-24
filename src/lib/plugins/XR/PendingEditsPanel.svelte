<script lang="ts">
	import { Text } from 'threlte-uikit'
	import { Button, ButtonIcon, ButtonLabel, Panel } from 'threlte-uikit/horizon'
	import { Icon, Redo2, Undo2 } from 'threlte-uikit/lucide'

	import { useWorld } from '$lib/ecs'
	import { resetStagedEdits } from '$lib/editing/resetStagedEdits'
	import { usePartConfig } from '$lib/hooks/usePartConfig.svelte'

	import WristDisplay from './WristDisplay.svelte'

	const partConfig = usePartConfig()
	const world = useWorld()

	const discard = () => {
		partConfig.discardChanges()
		resetStagedEdits(world)
	}
</script>

{#if partConfig.isDirty}
	<WristDisplay position={[0, 0.005, 0.1]}>
		<Panel
			flexDirection="column"
			padding={16}
			gap={12}
			backgroundColor="#111"
			borderRadius={16}
			minWidth={420}
		>
			<Text
				text="Pending frame edits"
				fontSize={18}
				color="#ffffff"
			/>
			<Panel
				flexDirection="row"
				gap={8}
			>
				<Button
					icon
					variant="tertiary"
					size="sm"
					disabled={!partConfig.canUndoFrameEdit}
					onclick={() => partConfig.undoFrameEdit()}
				>
					<ButtonIcon>
						<Icon is={Undo2} />
					</ButtonIcon>
				</Button>
				<Button
					icon
					variant="tertiary"
					size="sm"
					disabled={!partConfig.canRedoFrameEdit}
					onclick={() => partConfig.redoFrameEdit()}
				>
					<ButtonIcon>
						<Icon is={Redo2} />
					</ButtonIcon>
				</Button>
				<Button
					variant="tertiary"
					size="sm"
					onclick={discard}
				>
					<ButtonLabel>
						<Text
							text="Discard"
							fontSize={14}
							color="#ffffff"
						/>
					</ButtonLabel>
				</Button>
				<Button
					variant="primary"
					size="sm"
					onclick={() => partConfig.save()}
				>
					<ButtonLabel>
						<Text
							text="Save"
							fontSize={14}
							color="#ffffff"
						/>
					</ButtonLabel>
				</Button>
			</Panel>
		</Panel>
	</WristDisplay>
{/if}
