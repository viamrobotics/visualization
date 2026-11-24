<script lang="ts">
	import type { Entity } from 'koota'

	import { useThrelte } from '@threlte/core/webgpu'

	import { traits, useMappedEntitiesTraits } from '#lib/ecs/index.js'

	import { colorChannelsToHex, hexToColorChannels } from './colorChannelsHex'
	import SectionNotice from './SectionNotice.svelte'
	import SharedColor from './SharedColor.svelte'
	import { sharedValue } from './sharedValue'

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

	const definedColors = $derived(
		colors.current.filter((color) => color !== undefined).map(colorChannelsToHex)
	)
	const color = $derived(sharedValue(definedColors))
</script>

{#if definedColors.length === entities.length && definedColors[0]}
	<SharedColor
		label="color"
		value={color}
		mixedSeed={definedColors[0]}
		onchange={(hex) => {
			const next = hexToColorChannels(hex)
			for (const entity of entities) entity.set(traits.Color, next)
			invalidate()
		}}
	/>
{:else if definedColors.length > 0}
	<SectionNotice
		label="color"
		message="Not every selected object has a color."
	/>
{/if}
