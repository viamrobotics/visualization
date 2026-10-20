<script lang="ts">
	import { Input, Switch } from '@viamrobotics/prime-core'

	import ToggleGroup from '$lib/components/overlay/ToggleGroup.svelte'
	import { useSettings } from '$lib/hooks/useSettings.svelte'
	import { RENDER_MODES, type RenderMode } from '$lib/three/surfaceShading'

	const settings = useSettings()

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

				console.log(settings.current.renderArmModels)
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
				bind:value={settings.current.gridCellSize}
				on:keydown={(event) => event.stopImmediatePropagation()}
			/>
		</div>
	</label>

	<label class="flex items-center justify-between gap-2">
		Section size (m)

		<div class="w-20">
			<Input
				bind:value={settings.current.gridSectionSize}
				on:keydown={(event) => event.stopImmediatePropagation()}
			/>
		</div>
	</label>

	<label class="flex items-center justify-between gap-2">
		Fade distance (m)

		<div class="w-20">
			<Input
				bind:value={settings.current.gridFadeDistance}
				on:keydown={(event) => event.stopImmediatePropagation()}
			/>
		</div>
	</label>

	<h3 class="border-gray-3 border-b py-1 text-sm"><strong>Lines</strong></h3>

	<label class="flex items-center justify-between gap-2">
		Thickness

		<div class="w-20">
			<Input
				bind:value={settings.current.lineWidth}
				on:keydown={(event) => event.stopImmediatePropagation()}
			/>
		</div>
	</label>

	<label class="flex items-center justify-between gap-2">
		Dot size

		<div class="w-20">
			<Input
				bind:value={settings.current.lineDotSize}
				on:keydown={(event) => event.stopImmediatePropagation()}
			/>
		</div>
	</label>
</div>
