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

	interface Props {
		entity: Entity
		children?: Snippet
	}

	let { entity, children }: Props = $props()

	const linePositions = useTrait(() => entity, traits.LinePositions)
	const color = useTrait(() => entity, traits.Color)
	const pointColor = useTrait(() => entity, traits.PointColor)
	const pointSize = useTrait(() => entity, traits.PointSize)

	const resolvedPointColor = $derived.by(() => {
		const r = pointColor.current?.r ?? color.current?.r ?? 0
		const g = pointColor.current?.g ?? color.current?.g ?? 0
		const b = pointColor.current?.b ?? color.current?.b ?? 0
		return colorUtil.setRGB(r, g, b)
	})
</script>

<Frame {entity}>
	{@render children?.()}
</Frame>

{#if linePositions.current && pointSize.current}
	<LineDots
		color={resolvedPointColor}
		positions={linePositions.current}
		scale={pointSize.current}
	/>
{/if}
