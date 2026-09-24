<script lang="ts">
	import type { Entity } from 'koota'
	import type { Snippet } from 'svelte'

	import { useThrelte } from '@threlte/core'
	import { ElementRect } from 'runed'

	import DashboardButton from '$lib/components/overlay/dashboard/Button.svelte'
	import Popover from '$lib/components/overlay/Popover.svelte'
	import DashboardPortal from '$lib/components/overlay/Portals/DashboardPortal.svelte'
	import ToggleGroup from '$lib/components/overlay/ToggleGroup.svelte'
	import { traits, useWorld } from '$lib/ecs'
	import { useSettings } from '$lib/hooks/useSettings.svelte'

	import Ellipse from './Ellipse.svelte'
	import Lasso from './Lasso.svelte'
	import { provideSelectionPlugin } from './useSelectionPlugin.svelte'

	interface Props {
		/** Whether to auto-enable lasso mode when the component mounts */
		enabled?: boolean

		/** Allow manually going into selection state */
		selecting?: boolean

		// TODO: remove once a Selected trait exists
		autoSelectNewEntities?: boolean
		children?: Snippet
	}

	type SelectionType = 'lasso' | 'ellipse'

	let {
		enabled = false,
		selecting = false,
		autoSelectNewEntities = false,
		children,
	}: Props = $props()

	const { dom } = useThrelte()
	const world = useWorld()
	const settings = useSettings()
	const isSelectionMode = $derived(settings.current.interactionMode === 'select')

	const selectionPlugin = provideSelectionPlugin()

	let selectionType = $state<SelectionType>('lasso')

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

	let previousEntities: Entity[] = []
	$effect(() => {
		if (!autoSelectNewEntities) return

		const current = selectionPlugin.current
		const newEntities = current.filter((entity) => !previousEntities.includes(entity))
		previousEntities = [...current]

		const newest = newEntities.at(-1)
		if (newest === undefined) return

		const selected = world.query(traits.Selected)
		for (const entity of selected) {
			entity.remove(traits.Selected)
		}

		newest.add(traits.Selected)
	})

	const rect = new ElementRect(() => dom)
</script>

<DashboardPortal>
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

				<div class="font-public-sans text-default p-2 text-xs">
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
</DashboardPortal>

{#if isSelectionMode && rect.height > 0 && rect.width > 0}
	<Ellipse
		enabled={selectionType === 'ellipse'}
		{selecting}
	/>
	<Lasso
		enabled={selectionType === 'lasso'}
		{selecting}
	/>
	{@render children?.()}
{/if}
