<script lang="ts">
	import type { Entity } from 'koota'

	import { World } from '@threlte/rapier'

	import ModeTogglePortal from '#lib/components/overlay/Portals/ModeTogglePortal.svelte'
	import ModeButton from '#lib/components/overlay/workspace/ModeButton.svelte'
	import { traits, useQuery } from '#lib/ecs/index.js'
	import { useEnvironment, useEnvironmentMode } from '#lib/hooks/useEnvironment.svelte.js'
	import MonitorDetails from '#lib/plugins/Monitor/MonitorDetails.svelte'

	import CollisionDetector from './collisions/CollisionDetector.svelte'
	import MoveControls from './MoveControls.svelte'
	import MoveDashboard from './MoveDashboard.svelte'
	import SavedPoseControls from './savedPoses/SavedPoseControls.svelte'
	import SavedPoses from './savedPoses/SavedPoses.svelte'

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
	 * Move mode swaps the details panel for a move panel when one frame is selected. A
	 * selection it has no move panel for — a point cloud, a drawing, an obstacle —
	 * keeps its read-only details instead of losing its panel entirely. A saved pose
	 * gets its own panel, since moving to it is the one thing to do with one. Several
	 * selected objects share one read-only panel, since the motion service moves one at a time.
	 */
	const only = $derived(selected.current.length === 1 ? selected.current[0] : undefined)
	const onlyFrameName = $derived(only ? movableFrameName(only) : undefined)

	const hasMovableFrame = $derived(onlyFrameName !== undefined)

	const isMoveMode = $derived(environment.current.mode === 'move')
</script>

<ModeTogglePortal>
	<ModeButton
		class="-ml-px rounded-none"
		mode="move"
		description="Execute movement with a motion service"
	/>
</ModeTogglePortal>

{#if isMoveMode}
	<MoveDashboard />
	<SavedPoses />

	{#if only?.has(traits.SavedPose)}
		<SavedPoseControls entity={only} />
	{:else if only && onlyFrameName !== undefined}
		<MoveControls
			entity={only}
			frameName={onlyFrameName}
		/>
	{:else if selected.current.length > 0}
		<MonitorDetails
			entities={selected.current}
			notice={selected.current.length > 1
				? "Moving more than one frame at once isn't supported. Select a single frame to move it."
				: undefined}
		/>
	{/if}

	{#if hasMovableFrame}
		<World autoStart={false}>
			<CollisionDetector />
		</World>
	{/if}
{/if}
