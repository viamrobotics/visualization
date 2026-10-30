<script lang="ts">
	import { usePartConfig } from '$lib/hooks/usePartConfig.svelte'

	import BuildFramesMode from './BuildFramesMode.svelte'

	const partConfig = usePartConfig()
</script>

<!-- Every Build edit is saved through the part config, so with nothing to save it Build mode is left out. -->
{#if partConfig.hasConfigSource}
	<BuildFramesMode />
{/if}
