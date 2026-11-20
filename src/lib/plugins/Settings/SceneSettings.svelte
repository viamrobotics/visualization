<script lang="ts">
	import { Input, Switch } from '@viamrobotics/prime-core'

	import ToggleGroup from '#lib/components/overlay/ToggleGroup.svelte'
	import { useSettings } from '#lib/hooks/useSettings.svelte.js'
	import { RENDER_MODES, type RenderMode } from '#lib/three/surfaceShading.js'

	const settings = useSettings()

	const GRID_SIZE_STEP = 0.1

	// A text binding would save the raw string, so clearing a field to retype it collapsed the grid.
	const setGridSize = (
		key: 'gridCellSize' | 'gridSectionSize' | 'gridFadeDistance',
		event: Event
	): void => {
		const input = event.target as HTMLInputElement
		const value = Number.parseFloat(input.value)

		if (Number.isFinite(value) && value > 0) {
			settings.current[key] = value
		} else {
			input.value = String(settings.current[key])
		}
	}

	const renderModeOptions = $derived(
		RENDER_MODES.map((mode) => ({
			label: mode,
			value: mode,
			selected: settings.current.renderMode === mode,
		}))
	)
</script>

<div class="text-gray-9 flex flex-col gap-1 text-xs">
	<label class="flex items-center justify-between gap-2 py-1">
		Shading

		<ToggleGroup
			options={renderModeOptions}
			onSelect={([mode]) => {
				// Pressing the active button clears the group's value. A scene always has
				// a shading mode, so an empty selection keeps the current one.
				if (mode) {
					settings.current.renderMode = mode as RenderMode
				}
			}}
		/>
	</label>

	<label class="flex items-center justify-between gap-2 py-1">
		Arm Models

		<ToggleGroup
			multiple
			options={[
				{
					label: 'Colliders',
					value: 'colliders',
					selected: settings.current.renderArmModels.includes('colliders'),
				},
				{
					label: 'Model',
					value: 'model',
					selected: settings.current.renderArmModels.includes('model'),
				},
			]}
			onSelect={(value) => {
				settings.current.renderArmModels = (value.join('+') || 'colliders') as
					| 'colliders'
					| 'model'
					| 'colliders+model'
			}}
		/>
	</label>

	<label class="flex items-center justify-between gap-2">
		Object labels <Switch bind:on={settings.current.enableLabels} />
	</label>

	<h3 class="border-gray-3 border-b py-1 text-sm"><strong>Grid</strong></h3>

	<label class="flex items-center justify-between gap-2 py-1">
		Visible <Switch bind:on={settings.current.grid} />
	</label>

	<label class="flex items-center justify-between gap-2">
		Cell size (m)

		<div class="w-20">
			<Input
				type="number"
				min={GRID_SIZE_STEP}
				step={GRID_SIZE_STEP}
				value={settings.current.gridCellSize}
				on:change={(event) => setGridSize('gridCellSize', event)}
				on:keydown={(event) => event.stopImmediatePropagation()}
			/>
		</div>
	</label>

	<label class="flex items-center justify-between gap-2">
		Section size (m)

		<div class="w-20">
			<Input
				type="number"
				min={GRID_SIZE_STEP}
				step={GRID_SIZE_STEP}
				value={settings.current.gridSectionSize}
				on:change={(event) => setGridSize('gridSectionSize', event)}
				on:keydown={(event) => event.stopImmediatePropagation()}
			/>
		</div>
	</label>

	<label class="flex items-center justify-between gap-2">
		Fade distance (m)

		<div class="w-20">
			<Input
				type="number"
				min={GRID_SIZE_STEP}
				step={GRID_SIZE_STEP}
				value={settings.current.gridFadeDistance}
				on:change={(event) => setGridSize('gridFadeDistance', event)}
				on:keydown={(event) => event.stopImmediatePropagation()}
			/>
		</div>
	</label>
</div>
