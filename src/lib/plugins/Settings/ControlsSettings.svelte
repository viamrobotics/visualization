<script lang="ts">
	import { Input, Switch } from '@viamrobotics/prime-core'

	import { useSettings } from '$lib/hooks/useSettings.svelte'

	const settings = useSettings()

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
</script>

<div class="text-gray-9 flex flex-col gap-1 text-xs">
	<h3 class="border-gray-3 border-b py-1 text-sm"><strong>Camera</strong></h3>

	<label class="flex items-center justify-between gap-2">
		Smoothing (s)

		<div class="w-20">
			<Input
				type="number"
				min={MIN_SMOOTH_TIME}
				step={SMOOTH_TIME_STEP}
				value={settings.current.cameraSmoothTime}
				on:change={(event) => setSmoothTime('cameraSmoothTime', event)}
				on:keydown={(event) => event.stopImmediatePropagation()}
			/>
		</div>
	</label>

	<label class="flex items-center justify-between gap-2">
		Smoothing while dragging (s)

		<div class="w-20">
			<Input
				type="number"
				min={MIN_SMOOTH_TIME}
				step={SMOOTH_TIME_STEP}
				value={settings.current.cameraDraggingSmoothTime}
				on:change={(event) => setSmoothTime('cameraDraggingSmoothTime', event)}
				on:keydown={(event) => event.stopImmediatePropagation()}
			/>
		</div>
	</label>

	<p class="text-subtle-2">
		Seconds the camera takes to settle. Lower is snappier, and also shortens focus and reset
		animations.
	</p>

	<label class="flex items-center justify-between gap-2 py-1">
		Zoom toward cursor <Switch bind:on={settings.current.enableDollyToCursor} />
	</label>
</div>
