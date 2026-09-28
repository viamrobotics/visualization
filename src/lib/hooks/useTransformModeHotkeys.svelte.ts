import type { HotkeyKeybinding } from '$lib/keybindings'

import { KEYBINDINGS } from '$lib/keybindings'

import { useHotkey } from './useHotkeys.svelte'
import { type TransformGizmoMode, useTransformGizmos } from './useTransformGizmos.svelte'

const MODE_BINDINGS: readonly [HotkeyKeybinding, TransformGizmoMode][] = [
	[KEYBINDINGS.transformNone, 'none'],
	[KEYBINDINGS.transformTranslate, 'translate'],
	[KEYBINDINGS.transformRotate, 'rotate'],
	[KEYBINDINGS.transformScale, 'scale'],
]

/**
 * Binds the transform-mode shortcuts once, for whichever gizmo is mounted.
 *
 * The build and move gizmos used to bind these keys separately and relied on their modes
 * being mutually exclusive to avoid colliding. Registering here instead means one key with
 * one meaning, and a gizmo only has to say which modes it accepts.
 */
export const useTransformModeHotkeys = () => {
	const gizmos = useTransformGizmos()

	for (const [binding, mode] of MODE_BINDINGS) {
		useHotkey(binding, {
			when: () => gizmos.availableModes.has(mode),
			run: () => gizmos.select(mode),
		})
	}
}
