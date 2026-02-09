<script lang="ts">
	import { traits, useTrait } from '$lib/ecs'
	import HoveredEntityTooltip from './HoveredEntityTooltip.svelte'
	import { useFocusedEntity, useSelectedEntity } from '$lib/hooks/useSelection.svelte'

	const selectedEntity = useSelectedEntity()
	const focusedEntity = useFocusedEntity()

	const displayEntity = $derived(selectedEntity.current ?? focusedEntity.current)
	const hoverInfo = useTrait(() => displayEntity, traits.Hover)
</script>

{#if hoverInfo.current}
	<HoveredEntityTooltip hoverInfo={hoverInfo.current} />
{/if}
