<script module>
	import { Color } from 'three'

	const colorUtil = new Color()
</script>

<script lang="ts">
	import Frame from './Frame.svelte'
	import type { Snippet } from 'svelte'
	import type { Entity } from 'koota'
	import { traits, useTrait } from '$lib/ecs'
	import LineDots from './LineDots.svelte'
	import { darkenColor, defaultColor } from '$lib/color'

	interface Props {
		entity: Entity
		children?: Snippet
	}

	let { entity, children }: Props = $props()

	const linePositions = useTrait(() => entity, traits.LinePositions)
	const color = useTrait(() => entity, traits.Color)
	const pointColor = useTrait(() => entity, traits.PointColor)
	const opacity = useTrait(() => entity, traits.Opacity)
	const pointSize = useTrait(() => entity, traits.PointSize)

	const resolvedColor = $derived.by(() => {
		if (!color.current) return defaultColor
		const { r, g, b } = color.current
		return colorUtil.setRGB(r, g, b).getHexString()
	})

	const resolvedPointColor = $derived.by(() => {
		if (!pointColor.current) return darkenColor(resolvedColor, 10).getHexString()
		const { r, g, b } = pointColor.current
		return colorUtil.setRGB(r, g, b).getHexString()
	})
</script>

<Frame {entity}>
	{@render children?.()}
</Frame>

{#if linePositions.current && pointSize.current}
	<LineDots
		color={resolvedPointColor}
		positions={linePositions.current}
		scale={pointSize.current * 0.001}
		opacity={opacity.current ?? 1}
	/>
{/if}
