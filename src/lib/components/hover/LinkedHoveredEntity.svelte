<script lang="ts">
	import type { Entity } from 'koota'

	import { compileExpression } from 'filtrex'

	import { relations, traits, useTrait } from '#lib/ecs/index.js'
	import { SubEntityLinkType } from '#lib/ecs/relations.js'
	import { getLinkedHoverInfo, type HoverInfo } from '#lib/HoverUpdater.svelte.js'

	import HoveredEntityTooltip from './HoveredEntityTooltip.svelte'

	interface Props {
		linkedEntity: Entity
		entity: Entity
	}

	let { linkedEntity, entity }: Props = $props()

	const displayedHoverInfo = useTrait(() => entity, traits.InstancedMatrix)

	let hoverInfo = $state.raw<HoverInfo | null>(null)

	$effect(() => {
		if (entity && displayedHoverInfo.current) {
			const linkType = entity?.get(relations.SubEntityLink(linkedEntity))?.type
			if (linkType !== SubEntityLinkType.HoverLink) {
				return
			}

			// Index mapping is a formula with the variable 'index' in it.
			// Supported operations: https://github.com/cshaa/filtrex#expressions
			const indexMapping =
				entity?.get(relations.SubEntityLink(linkedEntity))?.indexMapping ?? 'index'
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
