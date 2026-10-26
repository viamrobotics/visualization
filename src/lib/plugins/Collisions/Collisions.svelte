<!--
@component

Detects intersecting geometry in every mode, lists each pair under the world tree's
Collisions folder, and opens a details panel for a selected pair. The mode plugins leave
pair entities out of their own panels, so this is the only one that renders for them.
-->
<script lang="ts">
	import { World } from '@threlte/rapier'

	import { traits, useQuery } from '$lib/ecs'
	import { useSettings } from '$lib/hooks/useSettings.svelte'
	import { useFullscreen } from '$lib/plugins/Fullscreen/useFullscreen.svelte'

	import CollisionDetails from './CollisionDetails.svelte'
	import CollisionDetector from './CollisionDetector.svelte'
	import { collisionReports } from './collisionStore.svelte'
	import { Collision } from './traits'

	const settings = useSettings()
	const fullscreen = useFullscreen()
	const selected = useQuery(traits.Selected)
	const selectedPairs = useQuery(traits.Selected, Collision)

	$effect(() => collisionReports.register())

	// The mode's own panels stack first, so these continue below them.
	const otherPanelCount = $derived(selected.current.length - selectedPairs.current.length)
</script>

{#if settings.current.enableCollisions}
	<World autoStart={false}>
		<CollisionDetector />
	</World>
{/if}

{#each selectedPairs.current as entity, index (entity)}
	<CollisionDetails
		{entity}
		style="transform: translate(0, {fullscreen.baseOffset + (otherPanelCount + index) * 40}px)"
	/>
{/each}
