<script
	lang="ts"
	module
>
	import { Parser } from 'expr-eval'

	export const parser = new Parser()
</script>

<script lang="ts">
	import type { Entity } from 'koota'

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
			// Index  Mapping is a formula with the variable 'index' in it, available operations can be found here: https://github.com/silentmatt/expr-eval/tree/master
			const indexMapping =
				displayEntity?.get(relations.SubEntityLink(linkedEntity))?.indexMapping ?? 'index'
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
