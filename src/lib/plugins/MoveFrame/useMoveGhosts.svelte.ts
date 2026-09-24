import type { Entity } from 'koota'
import type { Matrix4 } from 'three'

import { traits, useWorld } from '$lib/ecs'

import { clearMoveGhosts, createMoveGhosts, rigidMoveDelta, syncMoveGhosts } from './moveGhosts'

/**
 * Keep a staged move's ghost entities in step with the drag, for as long as the
 * frame has both a live pose and a staged goal.
 *
 * Takes the two matrices rather than the delta between them so the delta can
 * live in module scratch: a `Matrix4` mutated in place is `===` its old self,
 * and a `$derived` returning one would read as unchanged, freezing the ghosts
 * after the first drag frame. The matrices themselves are replaced wholesale
 * on every frame, so keying the effect on those stays correct at no cost.
 *
 * Two things move a ghost. The gizmo, once per drag frame. And a source's own
 * `WorldMatrix`, when the robot keeps moving under a still gizmo: the arm the
 * gripper hangs off carries on streaming poses, and the ghosts track it. Source
 * changes are coalesced into a microtask, the same shape the instanced
 * renderers use, so a burst of pose updates syncs once.
 *
 * Ghosts are torn down when the drag ends, the panel closes, or the component
 * unmounts — `syncMoveGhosts` clears the set as soon as an input goes away, so
 * there is no separate "stop" to remember to call.
 */
export const useMoveGhosts = (
	root: () => Entity | undefined,
	currentWorldMatrix: () => Matrix4 | undefined,
	targetWorldMatrix: () => Matrix4 | undefined
): void => {
	const world = useWorld()
	const ghosts = createMoveGhosts()

	const sync = () => {
		const current = currentWorldMatrix()
		const target = targetWorldMatrix()
		const delta = current && target ? rigidMoveDelta(current, target) : undefined
		syncMoveGhosts(world, root(), delta, ghosts)
	}

	$effect(sync)

	$effect(() => {
		let scheduled = false

		const unsubscribe = world.onChange(traits.WorldMatrix, (entity) => {
			// Ghosts write their own `WorldMatrix` in the sync below, and `ghosts` is
			// keyed by source entity. A ghost is never a key, so this guard filters
			// out self-triggered updates.
			if (scheduled || !ghosts.has(entity)) return
			scheduled = true
			queueMicrotask(() => {
				scheduled = false
				sync()
			})
		})

		return () => {
			unsubscribe()
			clearMoveGhosts(ghosts)
		}
	})
}
