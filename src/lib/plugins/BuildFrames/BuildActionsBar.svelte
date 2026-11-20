<script lang="ts">
	import { Button } from '@viamrobotics/prime-core'
	import { Redo2, Undo2 } from 'lucide-svelte'

	import Kbd from '#lib/components/overlay/Kbd.svelte'
	import OverlayPortal from '#lib/components/overlay/Portals/OverlayPortal.svelte'
	import { useWorld } from '#lib/ecs/index.js'
	import { resetStagedEdits } from '#lib/editing/resetStagedEdits.js'
	import { useEnvironment } from '#lib/hooks/useEnvironment.svelte.js'
	import { usePartConfig } from '#lib/hooks/usePartConfig.svelte.js'
	import { useHotkey } from '#lib/keybindings/index.js'

	const environment = useEnvironment()
	const partConfig = usePartConfig()
	const world = useWorld()

	const { ...rest } = $props()

	const undoKeybinding = useHotkey({
		id: 'editing.undo',
		key: 'z',
		mod: true,
		preventDefault: true,
		description: 'Undo the last frame edit',
		group: 'Editing',
		when: () => partConfig.canUndoFrameEdit,
		run: () => partConfig.undoFrameEdit(),
	})

	const redoKeybinding = useHotkey({
		id: 'editing.redo',
		key: 'z',
		mod: true,
		shift: true,
		preventDefault: true,
		description: 'Redo the last undone frame edit',
		group: 'Editing',
		when: () => partConfig.canRedoFrameEdit,
		run: () => partConfig.redoFrameEdit(),
	})

	const saveKeybinding = useHotkey({
		id: 'editing.save',
		key: 's',
		mod: true,
		preventDefault: true,
		description: 'Save staged frame edits',
		group: 'Editing',
		when: () => environment.current.isStandalone,
		run: () => partConfig.save(),
	})

	const discard = () => {
		partConfig.discardChanges()
		resetStagedEdits(world)
	}
</script>

<OverlayPortal>
	{#if environment.current.mode === 'build'}
		<div
			class="absolute bottom-4 z-4 flex w-full justify-center gap-2"
			{...rest}
		>
			<div class="border-light bg-light flex items-center gap-8 rounded border px-4 py-2 shadow-sm">
				<div class="flex flex-col">
					<p class="text-heading text-sm">
						<strong>Editing frames</strong>
					</p>

					<p
						class="text-subtle-2 text-sm"
						role="status"
					>
						{partConfig.isDirty ? 'Unsaved changes' : 'No unsaved changes'}
					</p>
				</div>

				<div class="flex gap-2">
					<Button
						aria-label="Undo frame edit"
						disabled={!partConfig.canUndoFrameEdit}
						onclick={() => partConfig.undoFrameEdit()}
					>
						<div class="flex items-center gap-2">
							<Undo2 size={14} />
							Undo
							<Kbd binding={undoKeybinding} />
						</div>
					</Button>

					<Button
						aria-label="Redo frame edit"
						disabled={!partConfig.canRedoFrameEdit}
						onclick={() => partConfig.redoFrameEdit()}
					>
						<div class="flex items-center gap-2">
							<Redo2 size={14} />
							Redo
							<Kbd binding={redoKeybinding} />
						</div>
					</Button>

					{#if environment.current.isStandalone}
						<Button
							onclick={discard}
							disabled={!partConfig.isDirty}
						>
							Discard
						</Button>

						<Button
							variant="dark"
							aria-label="Save"
							class="cursor-pointer text-blue-600"
							disabled={!partConfig.isDirty}
							onclick={() => {
								partConfig.save()
							}}
						>
							<div class="flex items-center gap-2">
								Save
								<Kbd binding={saveKeybinding} />
							</div>
						</Button>
					{/if}
				</div>
			</div>
		</div>
	{/if}
</OverlayPortal>
