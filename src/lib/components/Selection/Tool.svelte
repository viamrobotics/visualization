<script lang="ts">
	import type { Snippet } from 'svelte'

	import { useThrelte } from '@threlte/core'
	import { Portal } from '@threlte/extras'
	import { ElementRect } from 'runed'

	import DashboardButton from '$lib/components/overlay/dashboard/Button.svelte'
	import { useSettings } from '$lib/hooks/useSettings.svelte'

	import Popover from '../overlay/Popover.svelte'
	import ToggleGroup from '../overlay/ToggleGroup.svelte'
	import Ellipse from './Ellipse.svelte'
	import Lasso from './Lasso.svelte'
	import { provideSelectionPlugin } from './useSelectionPlugin.svelte'

	interface Props {
		/** Whether to auto-enable lasso mode when the component mounts */
		enabled?: boolean
		children?: Snippet
	}

	type SelectionType = 'lasso' | 'ellipse'

	let { enabled = false, children }: Props = $props()

	const { dom } = useThrelte()
	const settings = useSettings()
	const isSelectionMode = $derived(settings.current.interactionMode === 'select')

	provideSelectionPlugin()
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
	<Ellipse active={selectionType === 'ellipse'} />
	<Lasso active={selectionType === 'lasso'} />
	{@render children?.()}
{/if}
