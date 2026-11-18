<script lang="ts">
	import type { Entity } from 'koota'

	import { Switch } from '@viamrobotics/prime-core'
	import {
		Color,
		type ColorChangeEvent,
		type ColorValueRgbObject,
		Slider,
		type SliderChangeEvent,
	} from 'svelte-tweakpane-ui'
	import { Color as ThreeColor } from 'three'

	import type { ResourceAppearance, ResourceAppearancePatch } from '$lib/resourceAppearance'

	import { colors } from '$lib/color'
	import { traits, useOpacity, useTrait } from '$lib/ecs'

	interface Props {
		/** The frame being styled. Its current color and opacity show for a key nothing sets. */
		entity: Entity
		/** What is set at this level of the appearance being edited. */
		values: ResourceAppearance
		/** What shows for a key `values` leaves unset, such as the resource a frame inside follows. */
		fallback: ResourceAppearance
		/** Whether to offer the visible switch, which saves a frame as hidden until shown. */
		showsVisibility: boolean
		onchange: (patch: ResourceAppearancePatch) => void
	}

	const { entity, values, fallback, showsVisibility, onchange }: Props = $props()

	const OPACITY_STEP = 0.01
	const OPACITY_DECIMALS = 2
	const AXES_HELPER_DEFAULT = true
	const INVISIBLE_DEFAULT = false

	const entityColor = useTrait(() => entity, traits.Color)
	const entityOpacity = useOpacity(() => entity)

	const fallbackAxesHelper = $derived(fallback.show_axes_helper ?? AXES_HELPER_DEFAULT)
	const fallbackInvisible = $derived(fallback.invisible ?? INVISIBLE_DEFAULT)

	const colorValue = $derived.by<ColorValueRgbObject>(() => {
		const hex = values.color ?? fallback.color
		const color = hex ? new ThreeColor(hex) : entityColor.current
		const { r, g, b } = color ?? new ThreeColor(colors.default)
		return { r, g, b }
	})

	const handleColorChange = (event: ColorChangeEvent) => {
		if (event.detail.origin !== 'internal') return
		const { r, g, b } = event.detail.value as ColorValueRgbObject
		onchange({ color: `#${new ThreeColor().setRGB(r, g, b).getHexString()}` })
	}

	const handleOpacityChange = (event: SliderChangeEvent) => {
		if (event.detail.origin !== 'internal') return
		onchange({ opacity: Number(event.detail.value.toFixed(OPACITY_DECIMALS)) })
	}

	const handleVisibleChange = (isVisible: boolean) => {
		const isInvisible = !isVisible
		onchange({ invisible: isInvisible === fallbackInvisible ? undefined : isInvisible })
	}

	const handleAxesHelperChange = (isShown: boolean) => {
		onchange({ show_axes_helper: isShown === fallbackAxesHelper ? undefined : isShown })
	}
</script>

<div>
	<strong class="font-semibold">color</strong>
	<div aria-label="mutable color">
		<Color
			value={colorValue}
			type="float"
			on:change={handleColorChange}
		/>
	</div>
</div>

<div>
	<strong class="font-semibold">opacity</strong>
	<div aria-label="mutable opacity">
		<Slider
			value={values.opacity ?? fallback.opacity ?? entityOpacity.current}
			min={0}
			max={1}
			step={OPACITY_STEP}
			format={(value) => value.toFixed(OPACITY_DECIMALS)}
			on:change={handleOpacityChange}
		/>
	</div>
</div>

{#if showsVisibility}
	<div class="flex items-center justify-between">
		<strong class="font-semibold">visible</strong>
		<Switch
			aria-label="visible"
			on={!(values.invisible ?? fallbackInvisible)}
			on:change={(event) => handleVisibleChange(event.detail)}
		/>
	</div>
{/if}

<div class="flex items-center justify-between">
	<strong class="font-semibold">show axes helper</strong>
	<Switch
		aria-label="show axes helper"
		on={values.show_axes_helper ?? fallbackAxesHelper}
		on:change={(event) => handleAxesHelperChange(event.detail)}
	/>
</div>
