<script lang="ts">
	import type { Entity } from 'koota'
	import { compileExpression } from 'filtrex'

	import { relations, traits } from '$lib/ecs'
	import { useTrait } from '$lib/ecs'
	import { SubEntityLinkType } from '$lib/ecs/relations'
	import { useSelectedEntity } from '$lib/hooks/useSelection.svelte'
	import { useFocusedEntity } from '$lib/hooks/useSelection.svelte'
	import { getLinkedHoverInfo, type HoverInfo } from '$lib/HoverUpdater.svelte'

	import HoveredEntityTooltip from './HoveredEntityTooltip.svelte'

	interface Props {
		linkedEntity: Entity
	}

	let { linkedEntity }: Props = $props()

	const selectedEntity = useSelectedEntity()
	const focusedEntity = useFocusedEntity()
	const displayEntity = $derived(selectedEntity.current ?? focusedEntity.current)

	const displayedHoverInfo = useTrait(() => displayEntity, traits.InstancedPose)

	let hoverInfo = $state.raw<HoverInfo | null>(null)

	$effect(() => {
		if (displayEntity && displayedHoverInfo.current) {
			const linkType = displayEntity?.get(relations.SubEntityLink(linkedEntity))?.type
			if (linkType !== SubEntityLinkType.HoverLink) {
				return
			}
			// Index mapping is a formula with the variable 'index' in it.
			// Supported operations: https://github.com/cshaa/filtrex#expressions
			const indexMapping =
				displayEntity?.get(relations.SubEntityLink(linkedEntity))?.indexMapping ?? 'index'
			const evaluate = compileExpression(indexMapping)
			const resolvedIndex = evaluate({ index: displayedHoverInfo.current.index })
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
