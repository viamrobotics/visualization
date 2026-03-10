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
	import { darkenColor } from '$lib/color'

	interface Props {
		entity: Entity
		children?: Snippet
	}

	let { entity, children }: Props = $props()

	const linePositions = useTrait(() => entity, traits.LinePositions)
	const color = useTrait(() => entity, traits.Color)
	const pointSize = useTrait(() => entity, traits.PointSize)

	const resolvedColor = $derived(
		colorUtil
			.setRGB(color.current?.r ?? 1, color.current?.g ?? 0, color.current?.b ?? 0)
			.getHexString()
	)
</script>

<Frame {entity}>
	{@render children?.()}
</Frame>

{#if linePositions.current && pointSize.current}
	<LineDots
		color={darkenColor(resolvedColor, 10)}
		positions={linePositions.current}
		scale={pointSize.current * 0.001}
	/>
{/if}
