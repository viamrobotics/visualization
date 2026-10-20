<script lang="ts">
	import type { Entity } from 'koota'

	import { useThrelte } from '@threlte/core'
	import { Slider, type SliderChangeEvent } from 'svelte-tweakpane-ui'

	import { setOrAddTrait, traits, useOpacity } from '$lib/ecs'

	interface Props {
		entity: Entity
	}

	const { entity }: Props = $props()

	const { invalidate } = useThrelte()

	const opacity = useOpacity(() => entity)

	/**
	 * Writes `OpacityOverride`, never `Opacity`: reconcilers own the latter and
	 * rewrite it from the source on every tick, which is what used to drop the
	 * edit a moment after it was made.
	 */
	const handleOpacityChange = (event: SliderChangeEvent) => {
		if (event.detail.origin !== 'internal') return
		setOrAddTrait(entity, traits.OpacityOverride, event.detail.value)
		invalidate()
	}
</script>

<div>
	<strong class="font-semibold">opacity</strong>
	<div aria-label="mutable opacity">
		<Slider
			value={opacity.current}
			min={0}
			max={1}
			step={0.01}
			format={(v) => v.toFixed(2)}
			on:change={handleOpacityChange}
		/>
	</div>
</div>
