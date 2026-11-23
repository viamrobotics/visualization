<script lang="ts">
	import ModeTogglePortal from '#lib/components/overlay/Portals/ModeTogglePortal.svelte'
	import ModeButton from '#lib/components/overlay/workspace/ModeButton.svelte'
	import { traits } from '#lib/ecs/index.js'
	import { useSelectionOrder } from '#lib/hooks/useSelectionOrder.svelte.js'
	import { useEnvironment, useEnvironmentMode } from '#lib/hooks/useEnvironment.svelte.js'
	import { useFullscreen } from '#lib/plugins/Fullscreen/useFullscreen.svelte.js'

	import BuildActionsBar from './BuildActionsBar.svelte'
	import BuildDetails from './BuildDetails.svelte'
	import FramelessComponentDetails from './FramelessComponentDetails.svelte'
	import { provideObstaclePreviewToggle } from './obstaclePreviewToggle.svelte'
	import TransformDashboard from './TransformDashboard.svelte'
	import { useFramelessComponentEntities } from './useFramelessComponentEntities.svelte'
	import { useObstacleLivePreview } from './useObstacleLivePreview.svelte'

	const environment = useEnvironment()
	const selection = useSelectionOrder()
	// `FramelessComponent` is set at spawn and never changes, so a plain filter stays current.
	const selectedFrames = $derived(
		selection.current.filter((entity) => !entity.has(traits.FramelessComponent))
	)
	const selectedFrameless = $derived(
		selection.current.filter((entity) => entity.has(traits.FramelessComponent))
	)
	const fullscreen = useFullscreen()

	// Registering also resolves a persisted `build` for hosts that don't mount
	// this plugin, instead of pausing live queries with no UI out.
	useEnvironmentMode('build')

	useFramelessComponentEntities()
	provideObstaclePreviewToggle(useObstacleLivePreview())
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

<!-- One panel for the whole selection. Frameless components get theirs only when nothing else is selected. -->
{#if environment.current.mode === 'build'}
	{#if selectedFrames.length > 0}
		<BuildDetails
			entities={selectedFrames}
			framelessCount={selectedFrameless.length}
			style="transform: translate(0, {fullscreen.baseOffset}px)"
		/>
	{:else if selectedFrameless.length > 0}
		<FramelessComponentDetails
			entities={selectedFrameless}
			style="transform: translate(0, {fullscreen.baseOffset}px)"
		/>
	{/if}
{/if}
