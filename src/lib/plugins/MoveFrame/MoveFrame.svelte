<script lang="ts">
	import type { Entity } from 'koota'

	import { World } from '@threlte/rapier'

	import ModeTogglePortal from '$lib/components/overlay/Portals/ModeTogglePortal.svelte'
	import ModeButton from '$lib/components/overlay/workspace/ModeButton.svelte'
	import { traits, useQuery } from '$lib/ecs'
	import { useEnvironment, useEnvironmentMode } from '$lib/hooks/useEnvironment.svelte'
	import MonitorDetails from '$lib/plugins/Monitor/MonitorDetails.svelte'

	import CollisionDetector from './collisions/CollisionDetector.svelte'
	import MoveControls from './MoveControls.svelte'
	import MoveDashboard from './MoveDashboard.svelte'

	const environment = useEnvironment()
	const selected = useQuery(traits.Selected)

	useEnvironmentMode('move')

	/**
	 * The name the motion service can move an entity by, or `undefined` when it has
	 * none. The world root has no pose of its own to move, and a kinematic link is
	 * not a name the motion service can resolve — only the component that owns it is.
	 */
	const movableFrameName = (entity: Entity): string | undefined => {
		const frameName = entity.get(traits.Name)

		if (
			frameName === undefined ||
			frameName === 'world' ||
			!entity.has(traits.FramesAPI) ||
			entity.has(traits.KinematicLink)
		) {
			return undefined
		}

		return frameName
	}

	/**
	 * Move mode swaps the details panel for a move panel per selected frame, so the
	 * selection drives the panels the way it drives details in the other modes. A
	 * selection it has no move panel for — a point cloud, a drawing, an obstacle —
	 * keeps its read-only details instead of losing its panel entirely.
	 */
	const panels = $derived(
		selected.current.map((entity) => ({ entity, frameName: movableFrameName(entity) }))
	)

	const hasMovableFrame = $derived(panels.some((panel) => panel.frameName !== undefined))

	const isMoveMode = $derived(environment.current.mode === 'move')
</script>

<ModeTogglePortal>
	<ModeButton
		class="-ml-px rounded-l-none"
		mode="move"
		description="Execute movement with a motion service"
	/>
</ModeTogglePortal>

{#if isMoveMode}
	<MoveDashboard />

	{#each panels as { entity, frameName }, index (entity)}
		{@const style = `transform: translate(0, ${index * 40}px)`}

		{#if frameName === undefined}
			<MonitorDetails
				{entity}
				{style}
			/>
		{:else}
			<MoveControls
				{entity}
				{frameName}
				{style}
			/>
		{/if}
	{/each}

	{#if hasMovableFrame}
		<World autoStart={false}>
			<CollisionDetector />
		</World>
	{/if}
{/if}
