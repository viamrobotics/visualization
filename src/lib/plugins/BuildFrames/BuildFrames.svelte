<script lang="ts">
	import DomPortal from '#lib/components/overlay/Portals/DomPortal.svelte'
	import { usePartConfig } from '#lib/hooks/usePartConfig.svelte.js'

	import AddObjectMenu from './AddObjectMenu.svelte'
	import BuildFramesMode from './BuildFramesMode.svelte'

	const partConfig = usePartConfig()
</script>

<DomPortal id="world-tree-actions">
	<AddObjectMenu />
</DomPortal>

<!-- Every Build edit is saved through the part config, so with nothing to save it Build mode is left out. -->
{#if partConfig.hasConfigSource}
	<BuildFramesMode />
{/if}
