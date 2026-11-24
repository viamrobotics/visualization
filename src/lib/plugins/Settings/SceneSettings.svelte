<script lang="ts">
	import { NumberField, ToggleButtons } from '@viamrobotics/prime-controls'
	import { Switch } from '@viamrobotics/prime-ui'

	import { useSettings } from '#lib/hooks/useSettings.svelte.js'
	import { RENDER_MODES, type RenderMode } from '#lib/three/surfaceShading.js'

	const settings = useSettings()
	const uid = $props.id()

	const GRID_SIZE_STEP = 0.1

	type GridSizeKey = 'gridCellSize' | 'gridSectionSize' | 'gridFadeDistance'

	// A text binding would save the raw string, so clearing a field to retype it collapsed the grid.
	const setGridSize = (key: GridSizeKey, event: Event): void => {
		const input = event.target as HTMLInputElement
		const value = Number.parseFloat(input.value)

		if (Number.isFinite(value) && value > 0) {
			settings.current[key] = value
		} else {
			input.value = String(settings.current[key])
		}
	}

	// NumberField steps on ArrowUp and ArrowDown by writing its value, which fires no change event.
	const isStepKey = (event: KeyboardEvent): boolean =>
		event.key === 'ArrowUp' || event.key === 'ArrowDown'

	const gridSizeFields: { key: GridSizeKey; label: string }[] = [
		{ key: 'gridCellSize', label: 'Cell size (m)' },
		{ key: 'gridSectionSize', label: 'Section size (m)' },
		{ key: 'gridFadeDistance', label: 'Fade distance (m)' },
	]

	const renderModeItems = RENDER_MODES.map((mode) => ({ label: mode, value: mode }))

	type ArmModel = 'colliders' | 'model'

	const armModelItems: { label: string; value: ArmModel }[] = [
		{ label: 'Colliders', value: 'colliders' },
		{ label: 'Model', value: 'model' },
	]

	// The setting is a `+`-joined set, and at least colliders always draws, so turning everything off keeps them.
	const toggleArmModel = (model: ArmModel) => {
		const shown = new Set(settings.current.renderArmModels.split('+'))
		if (shown.has(model)) shown.delete(model)
		else shown.add(model)

		settings.current.renderArmModels = (armModelItems
			.filter((item) => shown.has(item.value))
			.map((item) => item.value)
			.join('+') || 'colliders') as 'colliders' | 'model' | 'colliders+model'
	}
</script>

<div class="text-gray-9 flex flex-col gap-1 text-xs">
	<div class="flex items-center justify-between gap-2 py-1">
		<span id="{uid}-shading">Shading</span>

		<ToggleButtons
			aria-labelledby="{uid}-shading"
			items={renderModeItems}
			bind:value={
				() => settings.current.renderMode,
				(mode) => {
					// Pressing the active button clears the group's value. A scene always has
					// a shading mode, so an empty selection keeps the current one.
					if (mode) settings.current.renderMode = mode as RenderMode
				}
			}
		/>
	</div>

	<div class="flex items-center justify-between gap-2 py-1">
		<span id="{uid}-arm-models">Arm Models</span>

		<div
			class="button-group"
			role="group"
			aria-labelledby="{uid}-arm-models"
		>
			{#each armModelItems as item (item.value)}
				{@const isShown = settings.current.renderArmModels.includes(item.value)}
				<button
					type="button"
					class={['button button-compact', isShown && 'button-dark']}
					aria-pressed={isShown}
					onclick={() => toggleArmModel(item.value)}
				>
					{item.label}
				</button>
			{/each}
		</div>
	</div>

	<label class="flex items-center justify-between gap-2">
		Object labels <Switch bind:checked={settings.current.enableLabels} />
	</label>

	<h3 class="border-gray-3 border-b py-1 text-sm"><strong>Grid</strong></h3>

	<label class="flex items-center justify-between gap-2 py-1">
		Visible <Switch bind:checked={settings.current.grid} />
	</label>

	{#each gridSizeFields as { key, label } (key)}
		<div class="flex items-center justify-between gap-2">
			<label
				id="{uid}-{key}-label"
				for="{uid}-{key}"
			>
				{label}
			</label>

			<div class="w-20">
				<NumberField
					id="{uid}-{key}"
					aria-labelledby="{uid}-{key}-label"
					min={GRID_SIZE_STEP}
					step={GRID_SIZE_STEP}
					value={settings.current[key]}
					onchange={(event) => setGridSize(key, event)}
					onkeyup={(event) => {
						if (isStepKey(event)) setGridSize(key, event)
					}}
					onkeydown={(event) => event.stopImmediatePropagation()}
				/>
			</div>
		</div>
	{/each}
</div>
