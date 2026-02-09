<script lang="ts">
	import { relations, traits } from '$lib/ecs'
	import type { Entity } from 'koota'
	import HoveredEntityTooltip from './HoveredEntityTooltip.svelte'
	import { getLinkedHoverInfo, type HoverInfo } from '$lib/HoverUpdater.svelte'
	import { useSelectedEntity } from '$lib/hooks/useSelection.svelte'
	import { useFocusedEntity } from '$lib/hooks/useSelection.svelte'
	import { Parser } from 'expr-eval'
	import { useTrait } from '$lib/ecs'

	const parser = new Parser()

	interface Props {
		linkedEntity: Entity
	}

	let { linkedEntity }: Props = $props()

	const selectedEntity = useSelectedEntity()
	const focusedEntity = useFocusedEntity()
	const displayEntity = $derived(selectedEntity.current ?? focusedEntity.current)

	const displayedHoverInfo = useTrait(() => displayEntity, traits.Hover)

	let hoverInfo: HoverInfo | null = $state.raw(null)

	$effect(() => {
		if (displayEntity && displayedHoverInfo.current) {
			const indexMapping =
				displayEntity?.get(relations.HoverLink(linkedEntity))?.indexMapping ?? '*1'
			const expression = parser.parse(indexMapping)
			const resolvedIndex = expression.evaluate({ index: displayedHoverInfo.current.index })
			const linkedHoverInfo = getLinkedHoverInfo(resolvedIndex, linkedEntity)
			hoverInfo = linkedHoverInfo
		} else {
			hoverInfo = null
		}
	})
</script>

{#if hoverInfo}
	<HoveredEntityTooltip {hoverInfo} />
{/if}
