<script lang="ts">
	import ModeTogglePortal from '#lib/components/overlay/Portals/ModeTogglePortal.svelte'
	import ModeButton from '#lib/components/overlay/workspace/ModeButton.svelte'
	import { traits, useQuery } from '#lib/ecs/index.js'
	import { useEnvironment, useEnvironmentMode } from '#lib/hooks/useEnvironment.svelte.js'
	import { useFullscreen } from '#lib/plugins/Fullscreen/useFullscreen.svelte.js'

	import MonitorDetails from './MonitorDetails.svelte'

	const environment = useEnvironment()
	const selected = useQuery(traits.Selected)
	const fullscreen = useFullscreen()

	useEnvironmentMode('monitor')
</script>

<ModeTogglePortal>
	<ModeButton
		class="rounded-r-none"
		mode="monitor"
		description="Monitor live machine data"
	/>
</ModeTogglePortal>

{#if environment.current.mode === 'monitor' && selected.current.length > 0}
	<MonitorDetails
		entities={selected.current}
		style="transform: translate(0, {fullscreen.baseOffset}px)"
	/>
{/if}
