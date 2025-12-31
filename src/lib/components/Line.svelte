<script lang="ts">
	import Frame from './Frame.svelte'
	import { useSettings } from '$lib/hooks/useSettings.svelte'
	import type { Snippet } from 'svelte'
	import type { Entity } from 'koota'
	import { traits, useTrait } from '$lib/ecs'
	import LineDots from './LineDots.svelte'

	interface Props {
		entity: Entity
		children?: Snippet
	}

	let { entity, children }: Props = $props()

	const settings = useSettings()
	const linePositions = useTrait(() => entity, traits.LinePositions)
	const pointColor = useTrait(() => entity, traits.PointColor)
	const pointSize = useTrait(() => entity, traits.PointSize)
</script>

<Frame {entity}>
	{@render children?.()}
</Frame>

{#if pointColor.current && linePositions.current}
	<LineDots
		color={[pointColor.current.r, pointColor.current.g, pointColor.current.b] as [
			number,
			number,
			number,
		]}
		positions={linePositions.current}
		scale={Number(pointSize.current ? pointSize.current : settings.current.lineDotSize)}
	/>
{/if}
