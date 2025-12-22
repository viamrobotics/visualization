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
	const dotColor = useTrait(() => entity, traits.DottedLineColor)
</script>

<Frame {entity}>
	{@render children?.()}
</Frame>

{#if dotColor.current && linePositions.current}
	<LineDots
		color={[dotColor.current.r, dotColor.current.g, dotColor.current.b] as [number, number, number]}
		positions={linePositions.current}
		scale={Number(settings.current.lineDotSize)}
	/>
{/if}
