<script lang="ts">
	import type { Entity } from 'koota'

	import { useThrelte } from '@threlte/core'
	import { Color, type ColorChangeEvent, type ColorValueRgbObject } from 'svelte-tweakpane-ui'

	import { traits, useTrait } from '#lib/ecs/index.js'

	interface Props {
		entity: Entity
	}

	const { entity }: Props = $props()

	const { invalidate } = useThrelte()
	const color = useTrait(() => entity, traits.Color)

	const handleColorChange = (event: ColorChangeEvent) => {
		if (event.detail.origin !== 'internal') return
		const next = event.detail.value as ColorValueRgbObject
		entity.set(traits.Color, { r: next.r, g: next.g, b: next.b })
		invalidate()
	}
</script>

{#if color.current}
	<div>
		<strong class="font-semibold">color</strong>
		<Color
			value={color.current}
			type="float"
			on:change={handleColorChange}
		/>
	</div>
{/if}
