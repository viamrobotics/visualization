<script lang="ts">
	import { Portal } from '@threlte/extras/webgpu'

	import { usePartConfig } from '#lib/hooks/usePartConfig.svelte.js'

	import AddObjectMenu from './AddObjectMenu.svelte'
	import BuildFramesMode from './BuildFramesMode.svelte'

	const partConfig = usePartConfig()
</script>

<Portal id="world-tree-actions">
	<AddObjectMenu />
</Portal>

<!-- Every Build edit is saved through the part config, so with nothing to save it Build mode is left out. -->
{#if partConfig.hasConfigSource}
	<BuildFramesMode />
{/if}
