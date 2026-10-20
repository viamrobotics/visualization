<script lang="ts">
	import { useEnvironment } from '$lib/hooks/useEnvironment.svelte'
	import { usePartID } from '$lib/hooks/usePartID.svelte'
	import { useSettings } from '$lib/hooks/useSettings.svelte'

	import FramePovWidget from './FramePovWidget.svelte'

	const settings = useSettings()
	const partID = usePartID()
	const environment = useEnvironment()

	// Which frames have a POV widget open is per-part and persisted with the rest of
	// the settings, so the panels come back on reload.
	const openFrameNames = $derived(settings.current.openFramePovWidgets[partID.current] || [])
</script>

<!-- A POV widget renders its own <View>, which has nowhere to draw while an
	immersive session owns the canvas. -->

{#if !environment.current.isImmersive}
	{#each openFrameNames as frameName (frameName)}
		<FramePovWidget {frameName} />
	{/each}
{/if}
