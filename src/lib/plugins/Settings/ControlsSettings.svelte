<script lang="ts">
	import { NumberField } from '@viamrobotics/prime-controls'
	import { Switch } from '@viamrobotics/prime-ui'

	import { useSettings } from '#lib/hooks/useSettings.svelte.js'

	const settings = useSettings()
	const uid = $props.id()

	const MIN_SMOOTH_TIME = 0
	const SMOOTH_TIME_STEP = 0.01

	const setSmoothTime = (
		key: 'cameraDraggingSmoothTime' | 'cameraSmoothTime',
		event: Event
	): void => {
		const value = Number.parseFloat((event.target as HTMLInputElement).value)

		if (Number.isFinite(value)) {
			settings.current[key] = Math.max(value, MIN_SMOOTH_TIME)
		}
	}

	// NumberField steps on ArrowUp and ArrowDown by writing its value, which fires no change event.
	const isStepKey = (event: KeyboardEvent): boolean =>
		event.key === 'ArrowUp' || event.key === 'ArrowDown'
</script>

<div class="text-gray-9 flex flex-col gap-1 text-xs">
	<h3 class="border-gray-3 border-b py-1 text-sm"><strong>Camera</strong></h3>

	<div class="flex items-center justify-between gap-2">
		<label
			id="{uid}-smooth-label"
			for="{uid}-smooth"
		>
			Smoothing (s)
		</label>

		<div class="w-20">
			<NumberField
				id="{uid}-smooth"
				aria-labelledby="{uid}-smooth-label"
				min={MIN_SMOOTH_TIME}
				step={SMOOTH_TIME_STEP}
				value={settings.current.cameraSmoothTime}
				onchange={(event) => setSmoothTime('cameraSmoothTime', event)}
				onkeyup={(event) => {
					if (isStepKey(event)) setSmoothTime('cameraSmoothTime', event)
				}}
				onkeydown={(event) => event.stopImmediatePropagation()}
			/>
		</div>
	</div>

	<div class="flex items-center justify-between gap-2">
		<label
			id="{uid}-dragging-smooth-label"
			for="{uid}-dragging-smooth"
		>
			Smoothing while dragging (s)
		</label>

		<div class="w-20">
			<NumberField
				id="{uid}-dragging-smooth"
				aria-labelledby="{uid}-dragging-smooth-label"
				min={MIN_SMOOTH_TIME}
				step={SMOOTH_TIME_STEP}
				value={settings.current.cameraDraggingSmoothTime}
				onchange={(event) => setSmoothTime('cameraDraggingSmoothTime', event)}
				onkeyup={(event) => {
					if (isStepKey(event)) setSmoothTime('cameraDraggingSmoothTime', event)
				}}
				onkeydown={(event) => event.stopImmediatePropagation()}
			/>
		</div>
	</div>

	<p class="text-subtle-2">
		Seconds the camera takes to settle. Lower is snappier, and also shortens focus and reset
		animations.
	</p>

	<label class="flex items-center justify-between gap-2 py-1">
		Zoom toward cursor <Switch bind:checked={settings.current.enableDollyToCursor} />
	</label>
</div>
