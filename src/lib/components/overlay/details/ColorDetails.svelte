<script lang="ts">
	import type { Entity } from 'koota'

	import { useThrelte } from '@threlte/core/webgpu'

	import { traits, useMappedEntitiesTraits } from '#lib/ecs/index.js'

	import SectionNotice from './SectionNotice.svelte'
	import SharedColor from './SharedColor.svelte'
	import { isNearlyEqual, sharedValue } from './sharedValue'

	interface Props {
		/** The selection. Never empty. */
		entities: readonly Entity[]
	}

	const { entities }: Props = $props()

	const { invalidate } = useThrelte()

	const colors = useMappedEntitiesTraits(
		() => entities,
		[traits.Color],
		(entity) => entity.get(traits.Color)
	)

	const definedColors = $derived(colors.current.filter((color) => color !== undefined))
	const color = $derived(
		sharedValue(
			definedColors,
			(a, b) => isNearlyEqual(a.r, b.r) && isNearlyEqual(a.g, b.g) && isNearlyEqual(a.b, b.b)
		)
	)
</script>

{#if definedColors.length === entities.length && definedColors[0]}
	<SharedColor
		label="color"
		value={color}
		mixedSeed={definedColors[0]}
		onchange={(next) => {
			for (const entity of entities) entity.set(traits.Color, { r: next.r, g: next.g, b: next.b })
			invalidate()
		}}
	/>
{:else if definedColors.length > 0}
	<SectionNotice
		label="color"
		message="Not every selected object has a color."
	/>
{/if}
