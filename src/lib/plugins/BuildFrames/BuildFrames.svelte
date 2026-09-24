<script lang="ts">
	import { Not } from 'koota'

	import ModeTogglePortal from '$lib/components/overlay/Portals/ModeTogglePortal.svelte'
	import ModeButton from '$lib/components/overlay/workspace/ModeButton.svelte'
	import { traits, useQuery } from '$lib/ecs'
	import { useEnvironment, useEnvironmentMode } from '$lib/hooks/useEnvironment.svelte'
	import { useFullscreen } from '$lib/plugins/Fullscreen/useFullscreen.svelte'

	import BuildActionsBar from './BuildActionsBar.svelte'
	import BuildDetails from './BuildDetails.svelte'
	import FramelessComponentDetails from './FramelessComponentDetails.svelte'
	import StaticGeometries from './StaticGeometries.svelte'
	import TransformDashboard from './TransformDashboard.svelte'
	import { useFramelessComponentEntities } from './useFramelessComponentEntities.svelte'

	const environment = useEnvironment()
	const selected = useQuery(traits.Selected, Not(traits.FramelessComponent))
	const selectedFrameless = useQuery(traits.Selected, traits.FramelessComponent)
	const fullscreen = useFullscreen()

	// Registering also resolves a persisted `build` for hosts that don't mount
	// this plugin, instead of pausing live queries with no UI out.
	useEnvironmentMode('build')

	useFramelessComponentEntities()
</script>

<ModeTogglePortal>
	<ModeButton
		class="-ml-px rounded-none"
		mode="build"
		description="Build the scene"
	/>
</ModeTogglePortal>

<!-- Each of these gates itself on build mode being active. -->
<TransformDashboard />
<BuildActionsBar />
<StaticGeometries />

{#if environment.current.mode === 'build'}
	{#each selected.current as entity, index (entity)}
		<BuildDetails
			{entity}
			style="transform: translate(0, {fullscreen.baseOffset + index * 40}px)"
		/>
	{/each}

	<!-- Offset past the panels above, so two stacks don't land on each other. -->
	{#each selectedFrameless.current as entity, index (entity)}
		<FramelessComponentDetails
			{entity}
			style="transform: translate(0, {fullscreen.baseOffset +
				(selected.current.length + index) * 40}px)"
		/>
	{/each}
{/if}
