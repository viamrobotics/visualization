import type { Entity } from 'koota'

import { onDestroy } from 'svelte'

import { traits } from '$lib/ecs'

import { cancelPending } from './spawn'
import * as gizmoTraits from './traits'
import { useGizmoInputs } from './useGizmoInputs.svelte'

interface Options {
	onCancel?: () => void
	onConfirm?: () => void
	onCommitAndContinue?: () => void
	onUndo?: () => void
}

/**
 * Owns the lifecycle of a gizmo the user is still building across several
 * clicks. The caller supplies the pending entity through `set` as it spawns or
 * replaces it, and this hook wires `useGizmoInputs`' four actions through to
 * the caller's handlers.
 *
 * On unmount an unconfirmed pending entity is destroyed rather than kept, and
 * its selection is cleared, so a tool that unmounts mid-placement (route away,
 * switch tools, cancel) never leaves a half-built gizmo or a dangling
 * selection behind. A confirmed entity, no longer tagged `PendingGizmo`, is
 * left alone.
 */
export const usePending = (options: () => Options = () => ({})) => {
	let pending = $state.raw<Entity>()

	useGizmoInputs({
		onCancel: () => options().onCancel?.(),
		onConfirm: () => options().onConfirm?.(),
		onCommitAndContinue: () => options().onCommitAndContinue?.(),
		onUndo: () => options().onUndo?.(),
	})

	onDestroy(() => {
		const isUnconfirmed = pending?.isAlive() && pending.has(gizmoTraits.PendingGizmo)
		if (isUnconfirmed && pending?.has(traits.Selected)) pending.remove(traits.Selected)
		cancelPending(pending)
	})

	return {
		get current() {
			return pending
		},

		set: (entity: Entity | undefined) => {
			pending = entity
		},
	}
}
