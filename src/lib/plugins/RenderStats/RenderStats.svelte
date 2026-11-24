<!--
@component

A draggable panel of render timings, draw counts, and resource counts, for finding what slows the
scene. The **Debug** settings tab turns it on. Hidden in an immersive XR session, where nothing
on the page is visible.
-->
<script lang="ts">
	import OverlayPortal from '#lib/components/overlay/Portals/OverlayPortal.svelte'
	import SettingsPortal from '#lib/components/overlay/Portals/SettingsPortal.svelte'
	import { useEnvironment } from '#lib/hooks/useEnvironment.svelte.js'
	import { useSettings } from '#lib/hooks/useSettings.svelte.js'

	import RenderStatsPanel from './RenderStatsPanel.svelte'
	import RenderStatsSettings from './RenderStatsSettings.svelte'

	const settings = useSettings()
	const environment = useEnvironment()
</script>

<SettingsPortal label="Debug">
	<RenderStatsSettings />
</SettingsPortal>

{#if settings.current.renderStats && !environment.current.isImmersive}
	<OverlayPortal>
		<RenderStatsPanel />
	</OverlayPortal>
{/if}
