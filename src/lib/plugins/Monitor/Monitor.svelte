<script lang="ts">
	import ModeTogglePortal from '$lib/components/overlay/Portals/ModeTogglePortal.svelte'
	import ModeButton from '$lib/components/overlay/workspace/ModeButton.svelte'
	import { traits, useQuery } from '$lib/ecs'
	import { useEnvironment, useEnvironmentMode } from '$lib/hooks/useEnvironment.svelte'
	import { useFullscreen } from '$lib/plugins/Fullscreen/useFullscreen.svelte'

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

{#if environment.current.mode === 'monitor'}
	{#each selected.current as entity, index (entity)}
		<MonitorDetails
			{entity}
			style="transform: translate(0, {fullscreen.baseOffset + index * 40}px)"
		/>
	{/each}
{/if}
