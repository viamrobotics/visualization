import { useThrelte } from '@threlte/core'

import { useHotkey } from '$lib/hooks/useHotkeys.svelte'

import { GizmoModes } from './gizmos'
import { useGizmos } from './useGizmos.svelte'

interface GizmoInputHandlers {
	/** Escape, or right-click: abandon the current tool without placing anything. */
	onCancel?: () => void
	/** Enter: accept the current placement as-is. */
	onConfirm?: () => void
	/** Space: commit the current placement and start another (polyline, angle). */
	onCommitAndContinue?: () => void
	/** Backspace: drop the most recently placed point. */
	onUndo?: () => void
}

/**
 * Keyboard and right-click inputs shared by every gizmo tool, rebuilt on the
 * `useHotkey` contribution point rather than a plugin-local `window` listener,
 * so dispatch policy (modifiers, repeats, editable targets) stays owned by
 * `KeyboardBindings`.
 *
 * Only `onCancel` is exercised in phase 1; the rest exist for the multi-click
 * tools phase 3 adds. A handler the caller omits is a no-op.
 */
export const useGizmoInputs = (handlers: GizmoInputHandlers) => {
	const gizmos = useGizmos()
	const armed = () => gizmos.mode !== GizmoModes.Idle

	useHotkey({
		key: 'Escape',
		description: 'Cancel the armed gizmo tool',
		when: armed,
		run: () => handlers.onCancel?.(),
	})

	useHotkey({
		key: 'Enter',
		description: 'Confirm the current gizmo placement',
		when: armed,
		run: () => handlers.onConfirm?.(),
	})

	useHotkey({
		key: ' ',
		description: 'Commit the current gizmo placement and place another',
		when: armed,
		preventDefault: true,
		run: () => handlers.onCommitAndContinue?.(),
	})

	useHotkey({
		key: 'Backspace',
		description: 'Undo the last placed gizmo point',
		when: armed,
		preventDefault: true,
		run: () => handlers.onUndo?.(),
	})

	// Right-click cancels too, but it has no hotkey contribution point — `useHotkey`
	// only wires keyboard dispatch. Rather than invent a mouse-event equivalent of
	// the hotkey registry for a single binding, listen on the canvas directly here.
	const { dom } = useThrelte()

	const onContextMenu = (event: MouseEvent) => {
		if (!armed()) return

		event.preventDefault()
		handlers.onCancel?.()
	}

	$effect(() => {
		dom.addEventListener('contextmenu', onContextMenu)
		return () => dom.removeEventListener('contextmenu', onContextMenu)
	})
}
