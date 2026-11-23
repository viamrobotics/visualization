<script lang="ts">
	import { Color, type ColorChangeEvent, type ColorValueRgbObject } from 'svelte-tweakpane-ui'

	import { MIXED, MIXED_TEXT, type Shared } from './sharedValue'

	interface Props {
		label: string
		/** In the picker's `float` sRGB channels. */
		value: Shared<ColorValueRgbObject>
		/** Where the picker starts when a mixed value is opened. */
		mixedSeed: ColorValueRgbObject
		/** Called with the picked color, for every entity. */
		onchange: (next: ColorValueRgbObject) => void
	}

	const { label, value, mixedSeed, onchange }: Props = $props()

	// Tweakpane's picker has no mixed state, so a mixed value shows a dash until it is opened.
	// Overridden on open, and re-derived to closed whenever the shared value changes.
	let isPicking = $derived.by(() => {
		void value
		return false
	})

	const handleChange = (event: ColorChangeEvent) => {
		if (event.detail.origin !== 'internal') return
		onchange(event.detail.value as ColorValueRgbObject)
	}
</script>

<div>
	<strong class="font-semibold">{label}</strong>
	<div aria-label={`mutable ${label}`}>
		{#if value === MIXED && !isPicking}
			<button
				type="button"
				class="border-medium bg-light text-subtle-1 hover:bg-medium focus-visible:outline-gray-6 mt-0.5 flex h-6 w-full items-center rounded-sm border px-2 text-left focus-visible:outline"
				aria-label={`${label}, mixed. Pick one for every selected object`}
				onclick={() => (isPicking = true)}
			>
				{MIXED_TEXT}
			</button>
		{:else}
			<Color
				value={value === MIXED ? mixedSeed : value}
				type="float"
				on:change={handleChange}
			/>
		{/if}
	</div>
</div>
