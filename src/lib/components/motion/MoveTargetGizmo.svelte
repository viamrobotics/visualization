<!--
@component

A drag handle for staging a goal pose for one frame, with no DOM of its own. Render it as a child of
`ScopedScene`. It draws the handle, a triad and travel line at the staged goal, and ghosts of what
hangs off the frame. It reports the goal through `target`, `onDrag`, and `onRelease`, and never
calls the motion service.
-->
<script lang="ts">
	import type { Matrix4 } from 'three'

	import MoveGizmo from '#lib/components/motion/MoveGizmo.svelte'
	import MoveTargetGhost from '#lib/components/motion/MoveTargetGhost.svelte'
	import { fromDestinationPose, toDestinationPose } from '#lib/components/motion/moveTargetPose.js'
	import { useMovedFrameMatrix } from '#lib/components/motion/useMovedFrameMatrix.svelte.js'
	import { useMoveGhosts } from '#lib/components/motion/useMoveGhosts.svelte.js'
	import { traits, useQuery } from '#lib/ecs/index.js'
	import { usePartID } from '#lib/hooks/usePartID.svelte.js'
	import { Pose } from '#lib/math/index.js'

	import type { MoveTarget } from './MoveTarget'
	import type { MoveTargetGizmoProps } from './MoveTargetGizmoProps'

	let {
		frame,
		target = $bindable(),
		disabled = false,
		mode = 'translate',
		space = 'world',
		onDrag,
		onRelease,
	}: MoveTargetGizmoProps = $props()

	const partID = usePartID()
	const namedEntities = useQuery(traits.Name)

	// The live end effector stays polled while disabled, so the target ghost keeps tracking it.
	const isAlwaysPolled = () => true

	const currentWorldMatrix = useMovedFrameMatrix(
		() => partID.current,
		() => frame,
		isAlwaysPolled
	)

	// A fresh `Matrix4` per target, because `MoveGizmo` and the ghosts key their effects on identity.
	const targetWorldMatrix = $derived(
		target ? fromDestinationPose(new Pose().copy(target.pose)) : undefined
	)

	const frameEntity = $derived(
		namedEntities.current.find((entity) => entity.get(traits.Name) === frame)
	)

	useMoveGhosts(
		() => frameEntity,
		() => currentWorldMatrix.current,
		() => targetWorldMatrix
	)

	/** The dragged world transform as a plain world-frame goal, in millimeters and degrees. */
	const toMoveTarget = (worldMatrix: Matrix4): MoveTarget => {
		const { x, y, z, oX, oY, oZ, theta } = toDestinationPose(worldMatrix)
		return { referenceFrame: 'world', pose: { x, y, z, oX, oY, oZ, theta } }
	}

	const handleDrag = (worldMatrix: Matrix4) => {
		const next = toMoveTarget(worldMatrix)
		target = next
		onDrag?.(next)
	}

	const handleRelease = () => {
		if (target) onRelease?.(target)
	}
</script>

<!-- Unmounting the handle is what ends a drag in progress and releases the camera controls. -->
{#if !disabled && currentWorldMatrix.current}
	<MoveGizmo
		currentWorldMatrix={currentWorldMatrix.current}
		{targetWorldMatrix}
		{mode}
		{space}
		onDrag={handleDrag}
		onRelease={handleRelease}
	/>
{/if}

{#if targetWorldMatrix && currentWorldMatrix.current}
	<MoveTargetGhost
		currentWorldMatrix={currentWorldMatrix.current}
		{targetWorldMatrix}
	/>
{/if}
