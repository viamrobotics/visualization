<script lang="ts">
	import { traits } from '$lib/ecs'
	import type { Entity } from 'koota'
	import { useWorld } from '$lib/ecs'
	import { onDestroy } from 'svelte'
	import HoveredEntityTooltip from './HoveredEntityTooltip.svelte'
	import type { HoverInfo } from '$lib/HoverUpdater.svelte'

	interface Props {
		hoveredEntity: Entity
	}

	let { hoveredEntity }: Props = $props()

	const world = useWorld()

	let hoverInfo: HoverInfo | null = $state.raw(null)

	const unsubChange = world.onChange(traits.Hover, (entity) => {
		if (entity === hoveredEntity) {
			hoverInfo = entity.get(traits.Hover) ?? null
		}
	})

	const unsubRemove = world.onRemove(traits.Hover, (entity) => {
		if (entity === hoveredEntity) {
			hoverInfo = null
		}
	})

	onDestroy(() => {
		unsubChange()
		unsubRemove()
	})
</script>

{#if hoverInfo}
	<HoveredEntityTooltip {hoverInfo} />
{/if}
