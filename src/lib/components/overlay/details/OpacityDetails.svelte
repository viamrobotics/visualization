<script lang="ts">
	import type { Entity } from 'koota'

	import { useThrelte } from '@threlte/core/webgpu'
	import { Slider, type SliderChangeEvent } from 'svelte-tweakpane-ui'

	import { resolveOpacity, setOrAddTrait, traits, useMappedEntitiesTraits } from '#lib/ecs/index.js'

	import { formatSharedNumber, sharedNumber, toInputNumber } from './sharedValue'

	interface Props {
		/** The selection. Never empty. */
		entities: readonly Entity[]
	}

	const { entities }: Props = $props()

	const { invalidate } = useThrelte()

	const opacities = useMappedEntitiesTraits(
		() => entities,
		[traits.Opacity, traits.OpacityOverride],
		resolveOpacity
	)

	const opacity = $derived(sharedNumber(opacities.current))

	/**
	 * Writes `OpacityOverride`, never `Opacity`: reconcilers own the latter and
	 * rewrite it from the source on every tick, which is what used to drop the
	 * edit a moment after it was made.
	 */
	const handleOpacityChange = (event: SliderChangeEvent) => {
		const next = event.detail.value
		// A mixed slider reports the NaN it was handed until the user moves it.
		if (event.detail.origin !== 'internal' || Number.isNaN(next)) return

		for (const entity of entities) setOrAddTrait(entity, traits.OpacityOverride, next)
		invalidate()
	}
</script>

<div>
	<strong class="font-semibold">opacity</strong>
	<div aria-label="mutable opacity">
		<Slider
			value={toInputNumber(opacity)}
			min={0}
			max={1}
			step={0.01}
			format={(value) => formatSharedNumber(value)}
			on:change={handleOpacityChange}
		/>
	</div>
</div>
