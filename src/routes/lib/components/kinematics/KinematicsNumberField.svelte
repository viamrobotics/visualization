<script lang="ts">
	import { Slider, type SliderChangeEvent } from 'svelte-tweakpane-ui'

	interface Props {
		label: string
		value: number
		/** Shown after the label, such as `mm`. */
		unit?: string
		onchange: (value: number) => void
	}

	const { label, value, unit, onchange }: Props = $props()

	const handleChange = (event: SliderChangeEvent) => {
		if (event.detail.origin !== 'internal') return
		onchange(event.detail.value)
	}
</script>

<div>
	<strong class="font-semibold">{label}</strong>
	{#if unit}<span class="text-subtle-2">({unit})</span>{/if}

	<div aria-label="mutable {label}">
		<Slider
			{value}
			on:change={handleChange}
		/>
	</div>
</div>
