<script lang="ts">
	import type { Entity, QueryResult, Trait } from 'koota'

	import { useThrelte } from '@threlte/core'
	import { Portal } from '@threlte/extras'
	import { Button } from '@viamrobotics/prime-core'
	import { ElementRect } from 'runed'

	import DashboardButton from '$lib/components/overlay/dashboard/Button.svelte'
	import { useWorld } from '$lib/ecs'
	import { useSettings } from '$lib/hooks/useSettings.svelte'

	import FloatingPanel from '../overlay/FloatingPanel.svelte'
	import Popover from '../overlay/Popover.svelte'
	import ToggleGroup from '../overlay/ToggleGroup.svelte'
	import Ellipse from './Ellipse.svelte'
	import Lasso from './Lasso.svelte'
	import * as selectionTraits from './traits'

	interface Props {
		/** Whether to auto-enable lasso mode when the component mounts */
		enabled?: boolean

		/** Fires when the user has committed to a lasso selection */
		onCommitSelections?: (entities: QueryResult<[Trait<() => boolean>]>) => void

		/** Fires when the user has made a selection */
		onSelection?: (entity: Entity) => void
	}

	type SelectionType = 'lasso' | 'ellipse'

	let { enabled = false, onCommitSelections, onSelection }: Props = $props()

	const { dom } = useThrelte()
	const world = useWorld()
	const settings = useSettings()
	const isSelectionMode = $derived(settings.current.interactionMode === 'select')
	let selectionType = $state<SelectionType>('lasso')

	const onClearClick = () => {
		for (const entity of world.query(selectionTraits.SelectionEnclosedPoints)) {
			if (world.has(entity)) {
				entity.destroy()
			}
		}
	}

	const onCommitClick = () => {
		const entities = world.query(selectionTraits.SelectionEnclosedPoints)
		onCommitSelections?.(entities)
	}

	$effect(() => {
		if (isSelectionMode) {
			settings.current.cameraMode = 'orthographic'
		}
	})

	$effect(() => {
		if (enabled) {
			settings.current.interactionMode = 'select'
		}
	})

	const rect = new ElementRect(() => dom)
</script>

<Portal id="dashboard">
	<fieldset>
		<div class="flex">
			<DashboardButton
				active={isSelectionMode}
				icon="selection-drag"
				description="{isSelectionMode ? 'Disable' : 'Enable'} selection"
				onclick={() => {
					settings.current.interactionMode = isSelectionMode ? 'navigate' : 'select'
				}}
			/>
			<Popover>
				{#snippet trigger(triggerProps)}
					<DashboardButton
						{...triggerProps}
						active={isSelectionMode}
						class="border-l-0"
						icon="filter-sliders"
						description="Selection settings"
					/>
				{/snippet}

				<div class="border-medium m-2 border bg-white p-2 text-xs">
					<div class="flex items-center gap-2">
						Selection type
						<ToggleGroup
							options={[
								{ label: 'Lasso', selected: selectionType === 'lasso' },
								{ label: 'Ellipse', selected: selectionType === 'ellipse' },
							]}
							onSelect={(details) => {
								selectionType = details.includes('Lasso') ? 'lasso' : 'ellipse'
							}}
						/>
					</div>
				</div>
			</Popover>
		</div>
	</fieldset>
</Portal>

{#if isSelectionMode && rect.height > 0 && rect.width > 0}
	<Ellipse
		active={selectionType === 'ellipse'}
		{onSelection}
	/>
	<Lasso
		active={selectionType === 'lasso'}
		{onSelection}
	/>

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
					onclick={onCommitClick}
					variant="success">Commit selection</Button
				>
				<Button
					onclick={onClearClick}
					variant="danger">Clear selection</Button
				>
			</div>
		</FloatingPanel>
	</Portal>
{/if}
