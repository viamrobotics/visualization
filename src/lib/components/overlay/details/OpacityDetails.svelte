<script lang="ts">
	import type { Entity } from 'koota'

	import { useThrelte } from '@threlte/core/webgpu'
	import { Slider } from '@viamrobotics/prime-controls'

	import { resolveOpacity, setOrAddTrait, traits, useMappedEntitiesTraits } from '#lib/ecs/index.js'

	import { MIXED, sharedNumber } from './sharedValue'

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
	const writeOpacity = (next: number) => {
		for (const entity of entities) setOrAddTrait(entity, traits.OpacityOverride, next)
		invalidate()
	}
</script>

<div>
	<strong class="font-semibold">opacity</strong>
	<!-- A mixed opacity has no single value, so the readout stays empty until the user picks one. -->
	<Slider
		aria-label="opacity"
		min={0}
		max={1}
		step={0.01}
		bind:value={() => (opacity === MIXED ? Number.NaN : opacity), writeOpacity}
	/>
</div>
