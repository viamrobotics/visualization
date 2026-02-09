<script lang="ts">
	import { relations, traits } from '$lib/ecs'
	import type { Entity } from 'koota'
	import { useWorld } from '$lib/ecs'
	import { onDestroy } from 'svelte'
	import HoveredEntityTooltip from './HoveredEntityTooltip.svelte'
	import { type HoverInfo, getLinkedHoverInfo } from '$lib/HoverUpdater.svelte'
	import { Parser } from 'expr-eval'

	const parser = new Parser()

	interface Props {
		hoveredEntity: Entity
		linkedEntity: Entity
	}

	let { hoveredEntity, linkedEntity }: Props = $props()

	const world = useWorld()

	let hoverInfo: HoverInfo | null = $state.raw(null)

	const unsubChange = world.onChange(traits.Hover, (entity) => {
		if (entity === hoveredEntity) {
			const hover = entity.get(traits.Hover)
			if (hover) {
				const indexMapping = entity.get(relations.HoverLink(linkedEntity))?.indexMapping ?? '*1'
				const expression = parser.parse(indexMapping)
				const resolvedIndex = expression.evaluate({ index: hover.index })
				const linkedHoverInfo = getLinkedHoverInfo(resolvedIndex, linkedEntity)
				if (linkedHoverInfo) {
					hoverInfo = linkedHoverInfo
				}
			}
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
