<script lang="ts">
	import { traits, useTrait } from '$lib/ecs'
	import { useFocusedEntity, useSelectedEntity } from '$lib/hooks/useSelection.svelte'

	import HoveredEntityTooltip from './HoveredEntityTooltip.svelte'

	const selectedEntity = useSelectedEntity()
	const focusedEntity = useFocusedEntity()

	const displayEntity = $derived(selectedEntity.current ?? focusedEntity.current)
	const hoverInfo = useTrait(() => displayEntity, traits.InstancedPose)
</script>

{#if hoverInfo.current}
	<HoveredEntityTooltip hoverInfo={hoverInfo.current} />
{/if}
