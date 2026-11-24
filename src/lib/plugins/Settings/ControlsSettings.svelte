<script lang="ts">
	import { Switch } from '@viamrobotics/prime-ui'

	import HeldNumberField from '#lib/components/overlay/HeldNumberField.svelte'
	import { useSettings } from '#lib/hooks/useSettings.svelte.js'

	const settings = useSettings()
	const uid = $props.id()

	const MIN_SMOOTH_TIME = 0
	const SMOOTH_TIME_STEP = 0.01

	const smoothTime = (key: 'cameraDraggingSmoothTime' | 'cameraSmoothTime') => ({
		get: () => settings.current[key],
		set: (value: number | undefined) => {
			if (value !== undefined) settings.current[key] = Math.max(value, MIN_SMOOTH_TIME)
		},
	})

	const smoothing = smoothTime('cameraSmoothTime')
	const draggingSmoothing = smoothTime('cameraDraggingSmoothTime')
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
			<HeldNumberField
				id="{uid}-smooth"
				aria-labelledby="{uid}-smooth-label"
				min={MIN_SMOOTH_TIME}
				step={SMOOTH_TIME_STEP}
				bind:value={smoothing.get, smoothing.set}
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
			<HeldNumberField
				id="{uid}-dragging-smooth"
				aria-labelledby="{uid}-dragging-smooth-label"
				min={MIN_SMOOTH_TIME}
				step={SMOOTH_TIME_STEP}
				bind:value={draggingSmoothing.get, draggingSmoothing.set}
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
