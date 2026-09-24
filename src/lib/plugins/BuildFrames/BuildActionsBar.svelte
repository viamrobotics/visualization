<script lang="ts">
	import { Button, Icon } from '@viamrobotics/prime-core'
	import { Redo2, Undo2 } from 'lucide-svelte'

	import OverlayPortal from '$lib/components/overlay/Portals/OverlayPortal.svelte'
	import { useWorld } from '$lib/ecs'
	import { resetStagedEdits } from '$lib/editing/resetStagedEdits'
	import { useEnvironment } from '$lib/hooks/useEnvironment.svelte'
	import { usePartConfig } from '$lib/hooks/usePartConfig.svelte'

	const environment = useEnvironment()
	const partConfig = usePartConfig()
	const world = useWorld()

	const { ...rest } = $props()

	const discard = () => {
		partConfig.discardChanges()
		resetStagedEdits(world)
	}

	const handleKeydown = (event: KeyboardEvent) => {
		if (environment.current.mode !== 'build') return

		const modifier = event.metaKey || event.ctrlKey
		const key = event.key.toLowerCase()

		if (modifier && key === 's' && environment.current.isStandalone) {
			event.preventDefault()
			event.stopImmediatePropagation()
			partConfig.save()
			return
		}

		const redo = modifier && (key === 'y' || (key === 'z' && event.shiftKey))
		const undo = modifier && key === 'z' && !event.shiftKey

		if (redo && partConfig.canRedoFrameEdit) {
			event.preventDefault()
			event.stopImmediatePropagation()
			partConfig.redoFrameEdit()
		} else if (undo && partConfig.canUndoFrameEdit) {
			event.preventDefault()
			event.stopImmediatePropagation()
			partConfig.undoFrameEdit()
		}
	}

	const isMacDevice = /Mac|iPod|iPhone|iPad/.test(navigator.userAgent)
	const iconName = isMacDevice ? ('apple-keyboard-command' as const) : ('chevron-up' as const)
	const iconLabel = isMacDevice ? 'command' : 'control'
</script>

<svelte:window onkeydowncapture={handleKeydown} />

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
							<div class="flex gap-2">
								Save
								<div class="font-roboto-mono text-disabled flex items-center">
									<Icon
										name={iconName}
										size="xs"
									/>
									<span class="sr-only">{iconLabel}</span>
									<span>S</span>
								</div>
							</div>
						</Button>
					{/if}
				</div>
			</div>
		</div>
	{/if}
</OverlayPortal>
